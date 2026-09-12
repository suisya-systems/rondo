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

import type { Basis } from "../advisory/proposal.js";
import {
  ackGate,
  answerGate,
  closeRun,
  deliverGate,
  presentGate,
  showGate,
  showRun,
  startContinuo,
  type VerifiedContinuo,
} from "../continuo/invoker.js";
import type { ContinuoResult, ObservedSession } from "../continuo/protocol.js";
import { lapTranscriptDirectory } from "../continuo/transcript.js";
import { allocate } from "../refrain/allocator.js";
import { isLanguageTag, type RunPlan, readRunPlan } from "../refrain/plan.js";
import {
  CONSERVATIVE_HOST_POLICY,
  type HostPolicy,
  hostPolicy,
  type LoopPolicy,
} from "../refrain/policy.js";
import { revisionPlan } from "../refrain/revision.js";
import {
  type IterationRecord,
  isTerminal,
  type JsonRecord,
  type LapReading,
  type OperatorVerificationClaim,
  readingCoverage,
} from "../store/records.js";
import {
  type IterationStore,
  openAdvisoryRecord,
  openIterationStore,
  type ReadOutcome,
} from "../store/sqlite.js";
import {
  approvedRetry,
  composeBetweenLaps,
  type ExplainOutcome,
  type ExplainPorts,
  elevateObservation,
  explainIteration,
  PROPOSABLE_KINDS,
  type ProposeOutcome,
  proposeRetry,
  recordAnswer,
  showProposal,
  type UnpromptedPorts,
} from "./advisory.js";
import { abandon, admit, conductorPorts, resume } from "./conductor.js";
import { asciiEscape, consoleSeams, legibleAsciiEscape, relayUpstream } from "./console.js";
import { allowedBashIn } from "./delegation.js";
import {
  inspectLapWork,
  inspectPushTarget,
  inspectTopicBranch,
  type LapFile,
  type LapWorkInspection,
  type LapWorkRequest,
  openPullRequest,
  type PushTargetInspection,
  pushTopicBranch,
} from "./forge.js";
import { type InboxOutcome, showInbox, type TranscriptLocation } from "./inbox.js";
import { evidenceOf, READING_REMOTE } from "./review.js";
import { serveOperatorPage } from "./web.js";
import { type Chrome, EN } from "./wording.js";

/**
 * The whole surface on one screen.
 *
 * ASCII only, and asserted so by `test/access/cli.test.ts`. That is D-0004 and
 * it is not decoration: the Windows cell's console may be cp932, where a
 * character it cannot encode crashes the writer rather than printing badly, and
 * vitest captures stdout through a UTF-8 path -- so a test that reads this
 * string is the only thing that catches an em-dash before an operator does.
 */
/**
 * Where the read-only page listens when nobody says.
 *
 * Above 1024 so it needs no privilege, and outside the ranges a browser
 * refuses outright. Nothing depends on the number: it is printed on the line
 * that starts the server.
 */
const DEFAULT_WEB_PORT = 7333;

export const USAGE = `rondo - the operator surface for delegated work

  rondo start --plan FILE --iteration-id ID [--prompt TEXT]
              [--prompt-file FILE]
                          take one request and run a lap, and stop at the gate.
                          --prompt-file reads the request from a file, byte for
                          byte, for a request too long or too many paragraphs
                          to type as a shell argument. It and --prompt say the
                          same thing two ways, so only one of them may be given.
                          The run id, the topic branch and the workspace are
                          derived from --iteration-id; rondo mints them, so
                          there is no flag to type them
  rondo answer [--iteration-id ID]
                          show the gate that is waiting for a person. Name one
                          when more than one iteration is open
  rondo answer --actor-id ID --body=TEXT [--iteration-id ID]
               [--verified=TEXT]
                          answer it, and settle the iteration. Write --body
                          with an equals sign: an answer may begin with a dash.
                          --verified says what you ran to check the work before
                          answering -- recorded on the iteration, and carried
                          into the pull request, as your claim: rondo did not
                          watch it run and does not say it did
  rondo revise --actor-id ID --body=TEXT [--iteration-id ID]
                          answer the gate with a change to make, and run a
                          second lap that continues from the first one's
                          branch. The second lap's run id, topic branch and
                          workspace are derived from --iteration-id, the same
                          way rondo start mints the first lap's
  rondo publish --repo OWNER/NAME --actor-id ID --iteration-id ID
                [--remote NAME] [--dry-run] [--allow-remote-mismatch]
                [--despite-review]
                          push the branch, open the pull request, close the run.
                          Refuses before it prints when the workspace cannot
                          push where the plan says, when the push remote and
                          --repo name different repositories, or when the
                          independent reading of the work raised something, was
                          never taken, or was taken over other commits.
                          --despite-review is how you overrule that last one
  rondo abandon --iteration-id ID --reason TEXT
                          end an iteration rondo cannot finish
  rondo elevate --iteration-id ID --actor-id ID --message-id ID
                --observation=TEXT --basis LOCATOR
                          hand one observation of yours to the advisory. The
                          observation becomes a message in the conversation and
                          the proposal records which message it came from and
                          who elevated it. --basis is required and names where
                          the observation rests: snapshot:/pointer,
                          iteration:ID, gate:ID#SEQ, run:ID, or
                          repo:PATH@COMMIT#FIRST-LAST. Write --observation with
                          an equals sign: an observation may begin with a dash
  rondo propose --iteration-id ID --successor-id ID
                --kind run_plan|agent_type|contract_keys
                          propose what a retry of one iteration could run under,
                          as an option set with exactly one recommended and the
                          contract each option would run under. --kind picks the
                          question: which plan it runs (run_plan), which agent
                          type it runs under (agent_type), or which keys that
                          agent type carries as granted rather than askable
                          (contract_keys). Records the proposal and every
                          contract before it shows them. Approving one records
                          the contract; rondo retry is what spends it
  rondo decide --proposal-id ID --actor-id ID --outcome approved|declined
               [--contract-digest DIGEST]
                          answer a proposal. --contract-digest is the contract
                          line of the option you are approving, copied from the
                          screen, and it is required on approved and refused on
                          declined. An explanation cannot be answered at all
  rondo retry --proposal-id ID
                          spend the approval against one proposal: admit the
                          retry it authorises, under the identity the proposal
                          was composed for. The contract that plan composes is
                          recomposed from the material as it stands now and
                          compared against the one you approved; if they differ
                          -- the catalog moved, the agent type changed, the
                          identity was taken -- nothing runs and the approval
                          is not spent. An approval is spendable once
  rondo inbox --actor-id ID
                          what is waiting on you, what is running, what changed
                          since you last looked, and what was put to you versus
                          withheld. Reads rondo's own rows and drives no
                          continuo. Looking is recorded: it counts what it
                          showed you (once per thing, however often it is
                          drawn) and moves your last-look mark
  rondo show --proposal-id ID
                          read one proposal back: its options in the order the
                          record holds them, which one is recommended, what each
                          rests on with the material under it, whether anybody
                          has answered, and what answering forecloses. Composed
                          from the row, so a proposal stays answerable long
                          after the screen that drafted it has scrolled away
  rondo between            say what spans every live lap: which are open against
                          the same base branch (with their run, branch and
                          workspace), which findings were read on more than one,
                          and what the two concurrency bounds have refused.
                          Reads rondo's own rows and drives no continuo. It
                          records what it said and proposes nothing: an
                          adjacency is where to look, not a collision rondo
                          observed
  rondo web [--port N]
                          serve one page on 127.0.0.1 (default port ${String(DEFAULT_WEB_PORT)})
                          showing what inbox, between and explain show, redrawn
                          every few seconds. Looking at it moves no last-look
                          mark and counts no presentation: a redraw writes
                          nothing. The one thing that does is an approve button
                          beside each open gate: it answers that gate 'approve'
                          as RONDO_APPROVER, by the same path rondo answer
                          takes, and is drawn only when that is set. There is
                          no authentication
                          because there is no route in from anywhere but this
                          machine
  rondo explain --iteration-id ID
                          say what the store holds about one iteration, with
                          what each claim rests on. Reads rondo's own rows and
                          drives no continuo, so it reaches a row that is stuck
                          or already ended. It records what it said and
                          proposes nothing: an explanation binds nothing and
                          cannot be approved

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

/**
 * The language rondo writes its own prose to the operator in (D-0055 rule 5).
 *
 * **A host fact, read where the host's other facts are read, and recorded
 * nowhere.** The host has one operator (D-0020), so their language is a
 * property of the host in the same way the store's path and the approver's name
 * are -- one variable in the set that already holds `RONDO_STORE`,
 * `RONDO_APPROVER`, `RONDO_CONTINUO_CLI` and the two bounds. There is no file,
 * no precedence order, no per-lap override and no plan field, which is what
 * keeps D-0019 rule 3's refusal of a configuration *layer* intact.
 *
 * **Above `Accept-Language` rather than instead of it** (D-0056 rules 2 and 3).
 * D-0055 refused the header; that refusal is withdrawn and the half of its
 * argument that survived is what places this variable *above* the browser's
 * list: a variable is a person stating a fact about this deployment's one
 * operator and is what the terminal reads, while a header is a browser-wide
 * preference set for the web at large. So a host that has spoken is not
 * overridden by a browser default, and the browser decides the first visit
 * exactly when the host has said nothing. Still no file, no precedence order of
 * its own, and not derived from the rows on screen.
 *
 * **Absent means nobody asked, and so does a well-formed tag this tree ships no
 * wording for** -- which under D-0056 rule 2 is a step *saying nothing* rather
 * than a step answering English, so the next one answers. That is why what is
 * carried to the page is the tag and not a resolved set.
 */
const OPERATOR_LANGUAGE_ENV = "RONDO_OPERATOR_LANGUAGE";

/**
 * The tag one host stated about its operator, or a refusal naming this
 * variable.
 *
 * **A tag and not a set** (D-0056 rule 3): the lookup happens per request in
 * `src/access/web.ts`, beside the other four steps of rule 2, because a step
 * that resolved to `EN` here could not be told from a step that said nothing.
 * `null` is *nobody asked*.
 *
 * **Refused before a page is served rather than ignored**, which is the
 * treatment the two capacity bounds already get: a mistyped tag is an operator
 * who asked for something and would otherwise get an English page with no
 * account of why. The grammar is `src/refrain/plan.ts`'s, shared because both
 * fields need the same answer; the message is this caller's, because one naming
 * `materialLanguage` would send an operator to the plan file to fix an
 * environment variable (D-0055 rule 5).
 *
 * An empty string is `unset` and not a refusal, on `hostPolicyOf`'s reading of
 * the same shape: `export RONDO_OPERATOR_LANGUAGE=` is how a shell says *never
 * mind*.
 */
export function operatorLanguage(
  environment: Readonly<Record<string, string | undefined>>,
): { readonly tag: string | null } | { readonly refusal: string } {
  const asked = environment[OPERATOR_LANGUAGE_ENV];
  if (asked === undefined || asked.trim() === "") {
    return { tag: null };
  }
  if (!isLanguageTag(asked)) {
    return {
      refusal:
        `${OPERATOR_LANGUAGE_ENV} is '${asked}', which is not an IETF language tag. A tag is a ` +
        "primary subtag and optional hyphenated subtags -- 'ja', 'zh-Hant' -- and unset means " +
        "rondo writes its own prose in English.",
    };
  }
  return { tag: asked };
}

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
  readonly command:
    | "start"
    | "answer"
    | "revise"
    | "publish"
    | "abandon"
    | "explain"
    | "between"
    | "elevate"
    | "inbox"
    | "propose"
    | "decide"
    | "retry"
    | "show"
    | "web"
    | "help";
  readonly planFile: string | null;
  readonly prompt: string | null;
  readonly promptFile: string | null;
  readonly iterationId: string | null;
  readonly actorId: string | null;
  readonly body: string | null;
  /** What the operator says they ran to check the work (#70). Their word, not rondo's. */
  readonly verified: string | null;
  readonly repo: string | null;
  readonly remote: string | null;
  readonly reason: string | null;
  readonly messageId: string | null;
  readonly observation: string | null;
  readonly basis: string | null;
  readonly successorId: string | null;
  readonly kind: string | null;
  readonly proposalId: string | null;
  readonly contractDigest: string | null;
  readonly outcome: string | null;
  readonly port: number | null;
  readonly dryRun: boolean;
  readonly allowRemoteMismatch: boolean;
  readonly despiteReview: boolean;
}

/** A command rondo understood, or the first reason it did not. */
export type ParseOutcome =
  | { readonly kind: "parsed"; readonly parsed: ParsedCommand }
  | { readonly kind: "refused"; readonly reason: string };

const FLAGS = {
  plan: { type: "string" },
  prompt: { type: "string" },
  "prompt-file": { type: "string" },
  "iteration-id": { type: "string" },
  "actor-id": { type: "string" },
  body: { type: "string" },
  verified: { type: "string" },
  repo: { type: "string" },
  remote: { type: "string" },
  reason: { type: "string" },
  "message-id": { type: "string" },
  observation: { type: "string" },
  basis: { type: "string" },
  "successor-id": { type: "string" },
  kind: { type: "string" },
  "proposal-id": { type: "string" },
  "contract-digest": { type: "string" },
  outcome: { type: "string" },
  port: { type: "string" },
  "dry-run": { type: "boolean" },
  "allow-remote-mismatch": { type: "boolean" },
  "despite-review": { type: "boolean" },
} as const;

const COMMANDS = [
  "start",
  "answer",
  "revise",
  "publish",
  "abandon",
  "explain",
  "between",
  "elevate",
  "inbox",
  "propose",
  "decide",
  "retry",
  "show",
  "web",
] as const;

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
export const FLAGS_BY_COMMAND: Readonly<Record<string, readonly string[]>> = {
  // `--run-id`, `--topic-branch` and `--workspace` are gone from `start` and
  // from `revise` (D-0023 rule 9): rondo derives all three from the iteration
  // id, which is now required rather than defaulted. D-0027 typed them on
  // `revise` because no allocator existed when it was written.
  start: ["plan", "prompt", "prompt-file", "iteration-id"],
  // `answer` gained `--iteration-id` because more than one iteration may be
  // waiting at once now, which is the whole point of D-0023.
  answer: ["actor-id", "body", "iteration-id", "verified"],
  revise: ["actor-id", "body", "iteration-id"],
  publish: [
    "repo",
    "actor-id",
    "remote",
    "iteration-id",
    "dry-run",
    "allow-remote-mismatch",
    "despite-review",
  ],
  abandon: ["iteration-id", "reason"],
  // **One flag, and `--iteration-id` is required rather than defaulted.** The
  // row this command most exists to explain is terminal (D-0032 rule 11's
  // enumeration is there because an abandoned iteration could not be found at
  // all), and "the live one" does not name it. A default that quietly explained
  // a different iteration would be the wrong answer rendered as confidently as
  // the right one.
  explain: ["iteration-id"],
  // **No flags at all, and that is the shape of the question.** A between-laps
  // composition is about every live lap and about no single one of them, so
  // there is nothing to name -- and no `--limit`, because a cap on what an
  // operator is shown is a withholding that names a rule (D-0037 rule 5) and
  // not a flag. It takes no `--actor-id` for `show`'s reason: it moves no
  // last-look mark.
  between: [],
  // **Five flags and every one of them required**, for `explain`'s reason and
  // one of elevation's own: this is where authority enters (#41 section 3), and
  // a default here would be rondo supplying part of an act it is recording a
  // person as having taken.
  elevate: ["iteration-id", "actor-id", "message-id", "observation", "basis"],
  // **One flag, and no `--since`.** The bound is the last-look mark and
  // nothing else (D-0032 rule 9): a `--since` an operator typed would be a
  // second cursor beside the stored one, and the first time the two disagreed
  // the screen would report a diff against a moment nobody marked.
  inbox: ["actor-id"],
  // **Two ids, both required, and neither has a default.** The subject is the
  // iteration whose work was not taken, and the successor is the identity the
  // retry would run as -- which `D-0023` makes the one name a person chooses,
  // because the run id, the topic branch and the workspace are derived from it.
  // A default for either would be rondo proposing something about a row nobody
  // named, under an identity nobody chose.
  propose: ["iteration-id", "successor-id", "kind"],
  // `--outcome` is typed rather than implied by the verb: D-0032 rule 6 makes
  // "declined" a row and not an absence, so refusing has to be as sayable as
  // approving. `--contract-digest` is the option's own value, which is why it
  // is copied off the screen rather than chosen by an index -- an index is a
  // position in a list that could have been re-rendered since.
  decide: ["proposal-id", "actor-id", "outcome", "contract-digest"],
  // **One flag, and no `--actor-id`, no `--iteration-id` and no
  // `--contract-digest`.** Everything else this verb needs is already written
  // down: who approved is on the decision row, which iteration it is about and
  // which identity it runs as are on the proposal, and the digest is the
  // approval itself. A flag for any of them would be a second place the same
  // fact lives, and the first time the two disagreed rondo would admit
  // something nobody approved.
  retry: ["proposal-id"],
  // One flag, and no `--actor-id`: reading a proposal back is not answering it
  // and not looking at the inbox, so it moves no last-look mark and needs no
  // identity. What it does write is the presentation (D-0036 rule 1), which is
  // a fact about the surface rather than about a person.
  show: ["proposal-id"],
  // One flag, and no `--actor-id`: whose inbox the page draws is
  // `RONDO_APPROVER`, the same identity every other command checks against, and
  // a second way to name it would be a way to read somebody else's inbox by
  // typing their name. The page writes nothing, so there is nothing to approve.
  web: ["port"],
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

  // **Two spellings of one value, and rondo takes neither rather than
  // guessing.** `--prompt` and `--prompt-file` overwrite the same field of the
  // plan, so a command line carrying both has said the request twice and the
  // second saying is not visible on the screen -- which is the same shape of
  // fault this whole command exists to remove. Refused here rather than
  // resolved by precedence: a rule about which one wins is a rule an operator
  // has to remember at the moment they are least able to check it.
  if (values["prompt"] !== undefined && values["prompt-file"] !== undefined) {
    return {
      kind: "refused",
      reason:
        "--prompt and --prompt-file both name the request, so only one of them may be given. " +
        "Drop whichever one is not the request you meant to run.",
    };
  }

  const text = (name: string): string | null => {
    const value = values[name];
    return typeof value === "string" ? value : null;
  };

  // **Checked here rather than handed to `listen`.** A port that is not a port
  // is refused before a server exists, and the range is the one an operating
  // system has: `Number("8080x")` is NaN and `Number("")` is 0, so a typo would
  // otherwise bind a port nobody typed.
  const rawPort = text("port");
  const port = rawPort === null ? null : Number(rawPort);
  if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    return {
      kind: "refused",
      reason: `--port is '${String(rawPort)}', and a port is a whole number from 1 to 65535.`,
    };
  }

  return {
    kind: "parsed",
    parsed: {
      command: command as ParsedCommand["command"],
      planFile: text("plan"),
      prompt: text("prompt"),
      promptFile: text("prompt-file"),
      iterationId: text("iteration-id"),
      actorId: text("actor-id"),
      body: text("body"),
      verified: text("verified"),
      repo: text("repo"),
      remote: text("remote"),
      reason: text("reason"),
      messageId: text("message-id"),
      observation: text("observation"),
      basis: text("basis"),
      successorId: text("successor-id"),
      kind: text("kind"),
      proposalId: text("proposal-id"),
      contractDigest: text("contract-digest"),
      outcome: text("outcome"),
      port,
      dryRun: values["dry-run"] === true,
      allowRemoteMismatch: values["allow-remote-mismatch"] === true,
      despiteReview: values["despite-review"] === true,
    },
  };
}

function emptyCommand(command: ParsedCommand["command"]): ParsedCommand {
  return {
    command,
    planFile: null,
    prompt: null,
    promptFile: null,
    iterationId: null,
    actorId: null,
    body: null,
    verified: null,
    repo: null,
    remote: null,
    reason: null,
    messageId: null,
    observation: null,
    basis: null,
    successorId: null,
    kind: null,
    proposalId: null,
    contractDigest: null,
    outcome: null,
    port: null,
    dryRun: false,
    allowRemoteMismatch: false,
    despiteReview: false,
  };
}

/** Write one line of rondo's own words, escaped like every other line. */
function say(line: string): void {
  consoleSeams.write(`${asciiEscape(line)}\n`);
}

/**
 * Write one value of continuo's own words, keeping its paragraphs legible.
 *
 * Only for a value that is the whole of what a line shows -- today that is
 * the gate's `rationale` -- and never for a value folded alongside others on a
 * line rondo composes, where an embedded newline must stay `\uXXXX` (see
 * `pickWaiting`'s comment on the ambiguous-iteration list, further down this
 * file). rondo#68.
 */
function sayLegible(line: string): void {
  consoleSeams.write(`${legibleAsciiEscape(line)}\n`);
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
      // is one of the two failures that may have left work running.
      relayUpstream(`continuo ${verb} timed out`, result.reason);
      return 1;
    case "endedAbnormally":
      // The other one (`D-0035`): the CLI never reached its own reporting path,
      // so whatever it had started is unaccounted for. Said in its own words
      // rather than folded into the line below, because "could not be read"
      // describes a document and there was none.
      relayUpstream(`continuo ${verb} ended without reporting`, result.reason);
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

    const delivered = await deliverOnce(continuo, request, gate.runId, verbs);
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

  const deliveredAgain = await deliverOnce(continuo, request, gate.runId, verbs);
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

/**
 * One delivery pass. Null when it worked; an exit status when it did not.
 *
 * `runId` is **the gate's own**, taken from the `gate show` payload rather than
 * from rondo's iteration row, for the reason {@link walkGate} gives about
 * message ids: the resource a relay is queued on is continuo's to decide, and a
 * run id sourced from anywhere else is a guess that happens to agree until it
 * does not. Null is continuo's answer for a gate scoped to no run, and then the
 * flag is left off -- which names the global resource, which is exactly where a
 * runless gate's relays live.
 */
async function deliverOnce(
  continuo: VerifiedContinuo,
  request: WalkRequest,
  runId: string | null,
  verbs: GateVerbs,
): Promise<number | null> {
  const delivered = await verbs.deliver(continuo, {
    db: request.db,
    destinationDir: request.destinationDir,
    holder: request.holder,
    runId,
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
  // **Read byte for byte, and not trimmed.** The request is a prompt written to
  // an agent: its paragraph breaks are the instruction's structure, and a
  // trailing newline a text editor wrote is not rondo's to remove either. This
  // is the same rule `--body` runs under (D-0025 rule 3) applied to the one
  // other field an operator supplies as prose. Before this flag existed, a
  // multi-paragraph request could not be typed as a shell argument at all, and
  // the operator wrote a throwaway script to inject it into the plan JSON --
  // which is the class of workaround the command line replaced.
  if (parsed.promptFile !== null) {
    try {
      payload["prompt"] = readFileSync(parsed.promptFile, "utf8");
    } catch (error) {
      return {
        refusal: `The prompt file could not be read: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
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
  // **The identity and not the whole parse.** The web surface has no
  // `ParsedCommand` and takes its actor from `RONDO_APPROVER` directly
  // (D-0041 rule 5); passing the one field this function ever read is what
  // lets both surfaces reach the same allowlist rather than two copies of it.
  actorId: string | null,
  environment: Readonly<Record<string, string | undefined>>,
): { actorId: string } | { refusal: string } {
  if (actorId === null) {
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
  if (actorId !== approver) {
    return {
      refusal:
        `--actor-id is '${actorId}' and ${APPROVER_ENV} is '${approver}'. They must be ` +
        "the same identity.",
    };
  }
  // The shape continuo requires of an identifier, checked **here** rather than
  // left to the verb that first carries it. An identity with whitespace in it
  // passes the allowlist and is then refused at the argument boundary -- after
  // `publish` has already pushed and opened a pull request, or after `answer`
  // has already presented and delivered. Rondo refuses before a process starts
  // when it can, and this is one of the places it can.
  if (/\s/.test(actorId) || actorId.startsWith("-")) {
    return {
      refusal:
        `--actor-id is '${actorId}', and continuo's identifiers carry no whitespace and ` +
        "do not begin with a dash. It would be refused partway through, after the effects before " +
        "it had already happened.",
    };
  }
  return { actorId: actorId };
}

/** Open rondo's own store, or say why it cannot be opened. */
function openStore(
  environment: Readonly<Record<string, string | undefined>>,
): { store: IterationStore; path: string } | { refusal: string } {
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
    // The path travels with the store because the advisory record is a second
    // port over the same file (see `openAdvisoryRecord`), and re-reading the
    // environment to find it would be a second place this value is validated.
    return { store: openIterationStore(path, bounds.policy), path };
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
  // **Ambiguity is counted over every live row, readable or not.** A row that
  // will not decode is still an iteration a person may have meant, and one that
  // still holds capacity; dropping it from the count would let "the live one"
  // silently name the only row that happened to parse, and `answer --body`
  // would then carry a human's answer to the other iteration's gate.
  if (readable.length + unreadable.length > 1) {
    const named = [
      ...readable.map((record) => `${record.id} (${record.status})`),
      ...unreadable.map((outcome) => `${outcome.id} (unreadable)`),
    ].join(", ");
    return {
      refusal:
        `${String(readable.length + unreadable.length)} iterations are live, so "the live one" ` +
        `does not name anything. Say which with --iteration-id ID: ${named}`,
    };
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

  // **`explain` is dispatched before continuo is started, for `abandon`'s
  // reason and one of its own.** It reads rondo's rows and drives no verb, so a
  // continuo that will not start is not a reason to withhold an account of the
  // row that is stuck behind it -- and the iteration this command most exists to
  // explain has already ended, which is exactly when nothing is worth spawning.
  if (parsed.command === "explain") {
    return await commandExplain(parsed, store, opened.path);
  }

  // **`between` is dispatched here for `explain`'s reason.** It reads rondo's
  // own rows across every live lap and drives no continuo verb, and the moment
  // an operator most wants to know what spans the laps is the moment one of
  // them is stuck behind something that will not start.
  if (parsed.command === "between") {
    const bounds = hostPolicyOf(environment);
    if ("refusal" in bounds) {
      return refuse(bounds.refusal);
    }
    return sayAdvisoryOutcome(
      await composeBetweenLaps({
        ...advisoryPorts(store, opened.path),
        policy: bounds.policy,
      }),
      "composition",
    );
  }

  // **`elevate` is dispatched here for `explain`'s reason exactly.** It reads
  // rondo's own rows and writes rondo's own rows; nothing about handing an
  // observation to the advisory needs a worker, and the observation most worth
  // elevating is often about a lap that has already ended.
  if (parsed.command === "elevate") {
    return await commandElevate(parsed, environment, store, opened.path);
  }

  // **`inbox` is dispatched here for `explain`'s reason, and most of all.** The
  // screen that says what is stuck has to be reachable when something is stuck,
  // and a continuo that will not start is one of the things it exists to show.
  if (parsed.command === "inbox") {
    return await commandInbox(parsed, environment, store, opened.path);
  }

  // **`web` is dispatched here for `inbox`'s reason, and it writes even less.**
  // The page is a second view of `inbox`, `between` and `explain`, all three of
  // which read rondo's own rows and drive no continuo verb -- so requiring a
  // working continuo to *look* at what is stuck would withhold the screen in
  // exactly the state it exists for.
  if (parsed.command === "web") {
    const bounds = hostPolicyOf(environment);
    if ("refusal" in bounds) {
      return refuse(bounds.refusal);
    }
    // **The language is read once, here, beside the other host facts, and a tag
    // that is not one refuses before a socket is opened** (D-0055 rule 5).
    const selected = operatorLanguage(environment);
    if ("refusal" in selected) {
      return refuse(selected.refusal);
    }
    // **The approver is read once, here, and decides whether there is a write
    // port at all** (D-0041 rules 4 and 5). Building the function and letting
    // the page decide not to draw a button would leave a door with nobody's
    // name on it reachable by a hand-written POST.
    const approver = environment[APPROVER_ENV];
    return await serveOperatorPage(
      {
        store,
        record: openAdvisoryRecord(opened.path),
        policy: bounds.policy,
        // **The host's statement, as a tag, and one step of five** (D-0056
        // rules 2 and 3). The page resolves it against the request's `?lang=`,
        // the remembered cookie and `Accept-Language`; what it resolves to is
        // handed back to `pageMaterial` below, so the fence block's two
        // standing sentences follow the *page* and not the host. The terminal's
        // language is still not this: `sayLapMaterial` is handed `EN`, because
        // the console's strings go through D-0004's escape and it has no CJK
        // substitutes (D-0055 rule 10).
        hostLanguage: selected.tag,
        answer:
          approver === undefined || approver === ""
            ? null
            : async (iterationId, body) =>
                await answerFromPage(environment, store, opened.path, approver, iterationId, body),
        // Read for the same reason and on the same condition: the material is
        // what a person is shown before they press, so it is drawn exactly
        // where the button is (D-0029 rule 2 and D-0041 rule 6).
        material:
          approver === undefined || approver === ""
            ? null
            : async (wording, record) => await pageMaterial(wording, environment, store, record),
        // **The approver and not an `--actor-id`.** An inbox is one person's,
        // and the identity rondo already trusts to answer a gate is the one
        // whose inbox this host draws. Unset is not a refusal: the other two
        // sections are about the host rather than about a person, so the page
        // still has most of itself to show.
        actorId: environment[APPROVER_ENV] ?? null,
        now: Date.now,
        // The page draws `inbox`'s own lines, so it asks the same question of
        // continuo -- and it is the surface that redraws itself, which is the
        // one D-0048 rule 4's "read at render time" has to keep honest.
        locateTranscript: transcriptPort(environment),
      },
      parsed.port ?? DEFAULT_WEB_PORT,
      say,
      (line) => refuse(line),
    );
  }

  // **`propose` and `decide` are dispatched here for `explain`'s reason.** Both
  // read and write rondo's own rows and drive no continuo verb: the iteration a
  // retry is proposed for has already ended, and an answer to a proposal is a
  // row in rondo's ledger. Requiring a working continuo to record either would
  // make them unreachable exactly where they are for.
  if (parsed.command === "propose") {
    return await commandPropose(parsed, store, opened.path);
  }
  if (parsed.command === "decide") {
    return await commandDecide(parsed, environment, opened.path);
  }

  // **`show` is dispatched here for `explain`'s reason.** It reads one of
  // rondo's own rows and drives no continuo verb, and the proposal most worth
  // reading back is often about a lap that has already ended.
  if (parsed.command === "show") {
    return await commandShow(parsed, store, opened.path);
  }

  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return refuse(`continuo is not usable: ${startup.reason}`);
  }
  const continuo = startup.continuo;
  const ports = conductorPorts(continuo, store);

  switch (parsed.command) {
    case "start":
      return await commandStart(parsed, ports, unpromptedPorts(store, opened.path), continuo);
    case "answer":
      return await commandAnswer(parsed, environment, store, ports, continuo);
    case "retry":
      return await commandRetry(
        parsed,
        store,
        opened.path,
        ports,
        unpromptedPorts(store, opened.path),
      );
    case "revise":
      return await commandRevise(
        parsed,
        environment,
        store,
        ports,
        unpromptedPorts(store, opened.path),
        continuo,
      );
    default:
      return await commandPublish(parsed, environment, store, continuo);
  }
}

/** Door one: take one request and run a lap. */
async function commandStart(
  parsed: ParsedCommand,
  ports: ReturnType<typeof conductorPorts>,
  advisory: UnpromptedPorts,
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

  const report = await admit(ports, advisory, plan, START_POLICY, iterationId);
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

/**
 * Door six: say what the store holds about one iteration, and record that it
 * said it.
 *
 * **The advisory is reached here and nowhere else** (D-0022 rules 1 and 2): this
 * function gathers, `src/advisory/` returns a value, and
 * `src/access/advisory.ts` writes the row and composes the lines. Nothing on
 * this path composes a contract or opens a gate, because `explanation` is the
 * kind that binds nothing (D-0032 rule 5).
 */
async function commandExplain(
  parsed: ParsedCommand,
  store: IterationStore,
  storePath: string,
): Promise<number> {
  if (parsed.iterationId === null) {
    return refuse(
      "explain needs --iteration-id ID. The row worth explaining is often one that has already " +
        "ended, and 'the live iteration' does not name it -- so there is no default, because a " +
        "default would explain a different row just as confidently.",
    );
  }
  return sayAdvisoryOutcome(
    await explainIteration(advisoryPorts(store, storePath), parsed.iterationId),
    "explanation",
  );
}

/**
 * The four things both advisory doors are handed, assembled once.
 *
 * `present` is overridable for the one caller whose surface is not this
 * process's stdout: the page has already rendered the claims, and a second copy
 * printed into the terminal `rondo web` runs in would be noise.
 */
function advisoryPorts(
  store: IterationStore,
  storePath: string,
  present?: (lines: readonly string[]) => void,
): ExplainPorts {
  return {
    store,
    record: openAdvisoryRecord(storePath),
    now: Date.now,
    present:
      present ??
      ((lines) => {
        for (const line of lines) {
          say(line);
        }
      }),
  };
}

/**
 * The ports the trigger a stopped lap pulls is handed (D-0043 rule 3).
 *
 * **Nothing here may stop a lap that would otherwise have run** (rule 11), and
 * there are two ways it could. The pin is a file, and a `cadenza.pin.json` that
 * will not read leaves nothing able to say which cadenza composed a contract;
 * the advisory's record is a **second connection to the store**, opened here
 * rather than shared, and opening it runs a schema. Neither is anything the lap
 * itself needs, so both absences travel as a value with their own sentence in
 * it instead of as a refusal or a throw -- the catch in the conductor cannot
 * help with either, because both happen before the admission it wraps.
 *
 * `present` is a no-op and is never called: this door shows nobody anything,
 * which is rule 9. It is passed because {@link ExplainPorts} is one bundle for
 * every door, and a second bundle differing by one field would be two things to
 * keep in step.
 */
export function unpromptedPorts(store: IterationStore, storePath: string): UnpromptedPorts {
  const pin = cadenzaRevision();
  if ("refusal" in pin) {
    return { unavailable: pin.refusal };
  }
  try {
    return { ...advisoryPorts(store, storePath, () => {}), cadenzaRevision: pin.revision };
  } catch (error) {
    return {
      unavailable:
        "the advisory's own connection to the store could not be opened: " +
        `${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * What every advisory door does with the answer it gets back.
 *
 * One function for `explain`, `elevate` and `propose` because the one thing
 * worth getting right is the same for all three: a subject that reached the
 * screen and was not counted exits **1**, with the record kept and the lines
 * still standing. Two copies of that rule are two places it can drift, and the
 * quiet outcome of a drift is an under-counted ledger (D-0032 rule 10).
 *
 * `noun` is what the door calls what it showed, and `next` is the command that
 * follows where there is one.
 */
function sayAdvisoryOutcome(
  outcome: ExplainOutcome | ProposeOutcome,
  noun: string,
  next?: string,
): number {
  if (outcome.kind === "refused") {
    return refuse(outcome.reason);
  }
  say(`recorded as proposal '${outcome.proposalId}'`);
  if (next !== undefined) {
    say(next);
  }
  if (outcome.kind === "presentedUncounted") {
    // **Status 1 rather than 0, and what was shown still stands on the
    // screen.** The operator has read it and the proposal is in the ledger; what
    // failed is the count of what was put to them, which is the one number
    // D-0032 rule 10 says nothing else can supply. Reporting success here would
    // make an under-counted ledger the quiet outcome.
    consoleSeams.writeError(
      asciiEscape(
        `This ${noun} was shown and was not counted as presented: ${outcome.reason}. ` +
          "The breakdown of what was put to you and what was not will be short by one.\n",
      ),
    );
    return 1;
  }
  return 0;
}

/**
 * One `--basis LOCATOR` as the closed union the advisory already has, or null.
 *
 * **A compact spelling of {@link Basis} and not a sixth form.** #41 section 3
 * requires that what is elevated carries its basis with it, and D-0032 rule 2
 * already fixes what a basis is: a locator, in one of five forms, never a copy
 * of the material. So the only thing missing was a way to type one on a command
 * line, which is this function and nothing more -- there is deliberately no
 * form meaning "the operator said so", because that is the claim with no basis
 * #39 measured an operator approving on.
 *
 * Total; never throws. An unrecognised prefix, a malformed tail and a pointer
 * that is not a pointer all read as null, and the caller says what the five
 * forms are.
 */
export function parseBasis(text: string): Basis | null {
  const at = text.indexOf(":");
  const form = at === -1 ? "" : text.slice(0, at);
  const rest = text.slice(at + 1);
  if (rest === "") {
    return null;
  }
  switch (form) {
    case "snapshot":
      // RFC 6901: the empty pointer is the whole document, and every other one
      // begins with a slash. A pointer that does not resolve is not refused
      // here -- the renderer says "does not resolve", which is the answer that
      // shows an operator what they actually cited.
      return rest.startsWith("/") ? { form: "snapshot", pointer: rest } : null;
    case "iteration":
      return { form: "iteration", iterationId: rest };
    case "run":
      return { form: "continuoRun", runId: rest };
    case "gate": {
      const hash = rest.lastIndexOf("#");
      const tail = rest.slice(hash + 1);
      // The tail is matched rather than coerced: `Number("")` is 0 and
      // `Number(" ")` is 0, so a gate cited with no sequence at all would
      // record as a citation of transition zero -- a reference to different
      // material, arrived at silently, which is worse than a refusal.
      const seq = /^\d+$/.test(tail) ? Number(tail) : Number.NaN;
      return hash <= 0 || !Number.isSafeInteger(seq)
        ? null
        : { form: "gateTransition", gateId: rest.slice(0, hash), transitionSeq: seq };
    }
    case "repo": {
      const match = /^(.+)@([^@#]+)#(\d+)-(\d+)$/.exec(rest);
      if (match === null) {
        return null;
      }
      const [, path, commit, first, last] = match as unknown as readonly string[];
      const firstLine = Number(first);
      const lastLine = Number(last);
      return firstLine < 1 || lastLine < firstLine
        ? null
        : {
            form: "repository",
            path: String(path),
            commit: String(commit),
            firstLine,
            lastLine,
          };
    }
    default:
      return null;
  }
}

/** The one sentence that lists what a `--basis` may be, written once. */
const BASIS_FORMS_LINE =
  "snapshot:/pointer, iteration:ID, gate:ID#SEQ, run:ID, or repo:PATH@COMMIT#FIRST-LAST";

/**
 * Door nine: hand one observation to the advisory, and record that a person
 * did it.
 *
 * **This is where authority enters** (#41 section 3): an observation constrains
 * nothing until a human takes it up, so the act is recorded as two columns on
 * the proposal -- which message it came from and who elevated it -- and the
 * identity is checked against `RONDO_APPROVER` before anything is written, the
 * same allowlist `answer` and `publish` pass through.
 *
 * **It composes no contract and the proposal it produces cannot be approved.**
 * The kind is `explanation`, so #41 section 3's chain reaches
 * `observation -> proposal` here and stops: what turns a proposal into a
 * contract is an approvable kind's option set, which is not this cut. The
 * elevation columns are written the same way whichever kind arrives later.
 */
async function commandElevate(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
): Promise<number> {
  if (parsed.iterationId === null || parsed.messageId === null) {
    return refuse(
      "elevate needs --iteration-id ID, naming the row the observation is about, and " +
        "--message-id ID, naming the observation itself in the conversation. Neither has a " +
        "default: an elevation is an act by a person, and rondo does not supply half of one.",
    );
  }
  if (parsed.observation === null || parsed.observation === "") {
    return refuse(
      "elevate needs --observation=TEXT, which is what you are handing over. Write it with an " +
        "equals sign: an observation may begin with a dash.",
    );
  }
  if (parsed.basis === null) {
    return refuse(
      `elevate needs --basis LOCATOR, naming where the observation rests: ${BASIS_FORMS_LINE}. ` +
        "It has no default and there is no form meaning 'because I say so': an observation that " +
        "carries no basis acquires the look of a proposal without acquiring the grounds for " +
        "one, which is the hazard elevating in one gesture creates.",
    );
  }
  const basis = parseBasis(parsed.basis);
  if (basis === null) {
    return refuse(
      `--basis is '${parsed.basis}', which is none of the forms a basis may take: ` +
        `${BASIS_FORMS_LINE}.`,
    );
  }
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  return sayAdvisoryOutcome(
    await elevateObservation(advisoryPorts(store, storePath), parsed.iterationId, {
      messageId: parsed.messageId,
      actorId: actor.actorId,
      observation: { label: "observation", value: parsed.observation, basis },
    }),
    "elevation",
  );
}

/**
 * Door ten: what is waiting on you, and the record that you looked.
 *
 * **`--actor-id` is checked against the approver allowlist, and that is a
 * reuse rather than a claim.** Looking is not answering and not publishing, so
 * the allowlist is stricter than this verb strictly needs: the reason it is
 * used anyway is that rondo has exactly one identity path today
 * ({@link approvedActor}), and a second one -- "anybody may look" -- would be
 * a second answer to who rondo acts for, introduced by a read-only screen. If
 * a reader who cannot approve ever has to see the inbox, this is the line that
 * moves, and the mark it writes is already per actor
 * (`operator_view.actor_id`), so nothing below it has to.
 */
/**
 * Door eleven: read one proposal back, so a gate is answerable later.
 *
 * **The whole of #39 is that this exists.** `propose` renders an option set
 * once, to the terminal that drafted it; everything a person needs in order to
 * answer -- the alternatives, the recommendation, what each rests on, what
 * answering forecloses -- is in the row, and until this verb nothing read it
 * back. The falsifier #39 names is whether an operator can answer correctly
 * while reading only the composed decision, and a decision that can only be
 * read while it is being composed does not meet it.
 */
async function commandShow(
  parsed: ParsedCommand,
  store: IterationStore,
  storePath: string,
): Promise<number> {
  if (parsed.proposalId === null) {
    return refuse(
      "show needs --proposal-id ID, naming the proposal to read back. The ids are on the " +
        "inbox, under what is waiting on you.",
    );
  }
  const pin = cadenzaRevision();
  if ("refusal" in pin) {
    return refuse(pin.refusal);
  }
  const outcome = await showProposal(
    {
      store,
      cadenzaRevision: pin.revision,
      record: openAdvisoryRecord(storePath),
      now: Date.now,
      present: (lines) => {
        for (const line of lines) {
          say(line);
        }
      },
    },
    parsed.proposalId,
  );
  if (outcome.kind === "refused") {
    return refuse(outcome.reason);
  }
  if (outcome.kind === "shownUncounted") {
    // Status 1 for `sayAdvisoryOutcome`'s reason exactly: the operator has read
    // it and what failed is the count of what was put to them, which is the one
    // number D-0032 rule 10 says nothing else can supply.
    consoleSeams.writeError(
      asciiEscape(
        `This proposal was shown and was not counted as presented: ${outcome.reason}. ` +
          "The breakdown of what was put to you and what was not will be short by one.\n",
      ),
    );
    return 1;
  }
  return 0;
}

async function commandInbox(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
): Promise<number> {
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  const outcome = await showInbox(
    {
      store,
      record: openAdvisoryRecord(storePath),
      now: Date.now,
      locateTranscript: transcriptPort(environment),
      present: (lines) => {
        for (const line of lines) {
          say(line);
        }
      },
    },
    actor.actorId,
  );
  return sayInboxOutcome(outcome);
}

/** What `inbox` does with the answer it gets back. */
function sayInboxOutcome(outcome: InboxOutcome): number {
  if (outcome.kind === "shown") {
    return 0;
  }
  // **Status 1, and the screen still stands.** The operator has read it; what
  // failed is rondo's record of the reading -- the count of what was put to
  // them (D-0032 rule 10) or the mark that makes the next look a diff (rule 9).
  // Reporting success would make an under-counted ledger, or a cursor that
  // silently stopped moving, the quiet outcome.
  for (const reason of outcome.reasons) {
    consoleSeams.writeError(asciiEscape(`This look was not fully recorded: ${reason}\n`));
  }
  return 1;
}

/**
 * The cadenza that composed a contract, read from the pin the repository keeps.
 *
 * **A file rather than a constant, because a constant would be a fifth place
 * the pin is written down** -- `cadenza.pin.json`, `vendor/cadenza.tgz.sha256`,
 * `package-lock.json` and the tarball are the four `test/cadenza/pin.test.ts`
 * already holds to one story, and a copy in `src/` would be one no test
 * compares. `composition.cadenza_revision` records *which* cadenza composed the
 * contract a person approved (D-0022 rule 18), so a stale copy here would
 * misattribute it silently.
 *
 * Read relative to this module rather than to the working directory: `src/` and
 * the built `dist/` sit at the same depth below the repository root, so one
 * relative URL answers for both.
 */
function cadenzaRevision(): { revision: string } | { refusal: string } {
  try {
    const raw = readFileSync(new URL("../../cadenza.pin.json", import.meta.url), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const revision =
      parsed !== null && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)["revision"]
        : undefined;
    if (typeof revision !== "string" || revision === "") {
      return {
        refusal:
          "cadenza.pin.json holds no 'revision', so which cadenza composed a contract could not be recorded.",
      };
    }
    return { revision };
  } catch (error) {
    return {
      refusal: `cadenza.pin.json could not be read: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Door seven: propose what a retry could run under, and record what was shown.
 *
 * **The approvable kinds reach an operator here** (D-0022 rule 4's union,
 * D-0032 rule 1's option set). Unlike `explain`, this path composes: it issues
 * the exact contract each option would run under, for the successor identity
 * the operator names, and records it before showing the digest -- which is
 * D-0022 rules 17 and 18 taken together, and the reason `src/access` takes the
 * cadenza arrow rule 5 granted it.
 *
 * **`--kind` is required and has no default.** The three kinds ask three
 * different questions -- which plan, which agent type, which keys -- and a
 * default would put one of them to a person who meant another, with the same
 * confident option set either way. It is `explain --iteration-id`'s rule
 * applied to a second flag.
 */
async function commandPropose(
  parsed: ParsedCommand,
  store: IterationStore,
  storePath: string,
): Promise<number> {
  if (parsed.iterationId === null || parsed.successorId === null) {
    return refuse(
      "propose needs --iteration-id ID and --successor-id ID: the first names the iteration " +
        "whose work was not taken, and the second is the identity the retry would run as. rondo " +
        "derives the run id and the topic branch from the second, so it is a person's to choose.",
    );
  }
  const kind = PROPOSABLE_KINDS.find((one) => one === parsed.kind);
  if (kind === undefined) {
    return refuse(
      `propose needs --kind, one of ${PROPOSABLE_KINDS.join(", ")}. They ask three different ` +
        "questions -- which plan the retry runs, which agent type it runs under, and which keys " +
        "that agent type carries as granted -- so there is no default: one of them would be put " +
        "to you as confidently as the one you meant.",
    );
  }
  const pin = cadenzaRevision();
  if ("refusal" in pin) {
    return refuse(pin.refusal);
  }
  const outcome = await proposeRetry(
    // The four ports every advisory door takes, plus the one this door needs:
    // which cadenza composed the contracts it is about to show (D-0022 rule 18).
    { ...advisoryPorts(store, storePath), cadenzaRevision: pin.revision },
    kind,
    parsed.iterationId,
    parsed.successorId,
  );
  return sayAdvisoryOutcome(
    outcome,
    "proposal",
    outcome.kind === "refused"
      ? undefined
      : `Next: rondo decide --proposal-id ${outcome.proposalId} --actor-id ID ` +
          "--outcome approved --contract-digest DIGEST",
  );
}

/**
 * Door eight: answer a proposal, and write down who answered it.
 *
 * **Every rule that decides whether this may be recorded is the store's**
 * (D-0032 rules 5 and 6): a kind that binds nothing is refused inside the
 * writer's own transaction, and so is an approval naming a contract that was
 * never composed for the proposal. What this function checks is what a command
 * line owes an operator before a write is attempted -- that the identity is the
 * approver's, and that an approval carries the digest it is approving.
 *
 * **Nothing is consumed here.** An approval recorded by this verb authorises an
 * issuance that {@link commandRetry} performs, in the store's own transaction;
 * until it does, D-0022 rule 19's *"approved and never spent"* query is what
 * reports it.
 */
async function commandDecide(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  storePath: string,
): Promise<number> {
  if (parsed.proposalId === null) {
    return refuse("decide needs --proposal-id ID, naming the proposal being answered.");
  }
  if (parsed.outcome !== "approved" && parsed.outcome !== "declined") {
    return refuse(
      "decide needs --outcome approved or --outcome declined. Declining is written down rather " +
        "than left as silence: 'the operator settled this' and 'nobody has answered' are " +
        "different facts about the same proposal.",
    );
  }
  const approving = parsed.outcome === "approved";
  if (approving && parsed.contractDigest === null) {
    return refuse(
      "approving needs --contract-digest DIGEST: the contract line of the option you are " +
        "approving, copied from the screen. What is recorded is the contract you were shown, " +
        "not the option's position in a list that may have been rendered again since.",
    );
  }
  if (!approving && parsed.contractDigest !== null) {
    return refuse(
      "--contract-digest is refused with --outcome declined: a refusal approves no contract, " +
        "and a digest on one would read as an approval that had been recorded as its opposite.",
    );
  }
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  const outcome = await recordAnswer(
    { record: openAdvisoryRecord(storePath), now: Date.now },
    {
      proposalId: parsed.proposalId,
      outcome: parsed.outcome,
      contractDigest: parsed.contractDigest,
      actorId: actor.actorId,
    },
  );
  if (outcome.kind === "refused") {
    return refuse(outcome.reason);
  }
  say(`recorded as decision '${outcome.decisionId}'`);
  if (approving) {
    say(
      "This records that you approved that contract. Nothing has been spent: the admission " +
        "that reads this decision is 'rondo retry', and it compares the contract your plan " +
        "composes against the one above before anything runs.",
    );
    say(`Next: rondo retry --proposal-id ${parsed.proposalId}`);
  }
  return 0;
}

/**
 * Door eleven: spend one approval, and run the retry it authorises.
 *
 * **The last link of #41 section 3's chain** -- observation, elevation,
 * proposal, approval, contract -- and the one #107 measured as missing. Nothing
 * new is decided here: `approvedRetry` re-derives, from the material as it
 * stands now, which plan composes the contract a person approved, and `admit()`
 * hands the approval to `reserve()` so the consumption row and the iteration
 * row are written in one transaction (D-0022 rule 9).
 *
 * **Every refusal is fail-closed and none of them spends anything.** A digest
 * that no longer matches, an approval already spent, a successor identity
 * somebody took: each ends with no row, no run and the approval still standing
 * (D-0043 rule 8).
 */
async function commandRetry(
  parsed: ParsedCommand,
  store: IterationStore,
  storePath: string,
  ports: ReturnType<typeof conductorPorts>,
  advisory: UnpromptedPorts,
): Promise<number> {
  if (parsed.proposalId === null) {
    return refuse(
      "retry needs --proposal-id ID, naming the proposal whose approval it spends. There is no " +
        "default: an approval is spendable once, and 'the obvious one' is not a thing rondo " +
        "may decide on a person's behalf.",
    );
  }
  // The presenter is silenced: this verb shows nothing a person answers, and a
  // proposal re-rendered here would be a presentation nobody asked for
  // (D-0042).
  const resolved = await approvedRetry(
    advisoryPorts(store, storePath, () => {}),
    parsed.proposalId,
  );
  if (resolved.kind === "refused") {
    return refuse(resolved.reason);
  }
  const retry = resolved.retry;
  say(
    `decision '${retry.decisionId}' approved ${retry.contractDigest}, and that is the contract ` +
      `the plan below composes under '${retry.successorId}'`,
  );
  say(`retrying '${retry.subjectId}' as iteration '${retry.successorId}'`);
  say("the lap is the step that is slow");
  const report = await admit(
    ports,
    advisory,
    retry.plan,
    START_POLICY,
    retry.successorId,
    // The retry supersedes the row it was proposed about (D-0030 rule 1), and
    // the lineage is written by `reserve()` in the same transaction as the
    // consumption -- so a spent approval and the row it authorised are one
    // record or neither.
    retry.subjectId,
    { decisionId: retry.decisionId, contractDigest: retry.contractDigest },
  );
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
/**
 * What the operator is shown about the work itself, on every path that answers.
 *
 * **This is the half of D-0029 the entry says is worth more than the rest**, and
 * the measurement it answers is in `docs/operations/lap-1-dogfood.md`: the gate
 * carries `rationale`, which is the worker's own account of its own work, and
 * this command used to print that and no workspace path, no branch and nothing
 * a person could go and look at. An operator was recorded approving on it.
 *
 * **The two callers are not equal, and the difference is stated rather than
 * blurred.** On the reading path this arrives before an answer is typed and
 * informs it. On the one-shot `--body` path the answer is already given and
 * `walkGate` follows with no further chance to take input, so there it is a
 * **receipt**: a record of what was approved over. Closing the rest of that gap
 * is the procedure's job -- a step that reads before it answers -- and not a
 * refusal here, because a machine standing between a person and their own gate
 * answer is what D-0029 rule 3 refuses on the clock argument.
 */
async function sayLapMaterial(
  store: IterationStore,
  record: IterationRecord,
  continuo: VerifiedContinuo | null,
): Promise<void> {
  // **`EN` and not the host's set** (D-0055 rule 10). This is the console, and
  // D-0004's escape has no CJK substitutes: a Japanese fence block would print
  // here as `\uXXXX`. The page's copy of the same lines is handed the
  // operator's set in `pageMaterial`.
  for (const line of await lapMaterialLines(EN, store, record, continuo)) {
    say(line);
  }
}

/**
 * The same material as lines, for a surface that is not a terminal.
 *
 * **Lifted out rather than copied**, which is D-0041 rule 6 itself:
 * the page offers an approve button, and a person pressing it must be shown what
 * `rondo answer` shows them -- the branch, the workspace, the commit subjects,
 * the paths and the independent reading -- or the screen that is easier to reach
 * is also the screen that asks for less before it writes. Two renderings of this
 * would be two things to keep true; one list of lines, printed by the terminal
 * and put in a `<pre>` by the page, is one.
 */
export async function lapMaterialLines(
  wording: Chrome,
  store: IterationStore,
  record: IterationRecord,
  continuo: VerifiedContinuo | null,
): Promise<readonly string[]> {
  const workspace = planField(record, "workspace");
  const topicBranch = planField(record, "topic_branch");
  const lines: string[] = [
    `work    ${topicBranch === "" ? "(no topic branch on the row)" : topicBranch}`,
    `        in ${workspace === "" ? "(no workspace on the row)" : workspace}`,
  ];
  // **The commits and the files, not a count of them.** A summary that said
  // "3 commits, 2 files" would leave the person exactly where the gate's own
  // `rationale` leaves them: told that work happened, and told it by a summary.
  // D-0029 rule 2 asks for the base ref, the subjects and the paths, and the
  // point of asking is that a subject is the one place a lap says what it did
  // in words nobody generated for this screen.
  const range = readingRangeOf(record);
  if (range === null) {
    lines.push("        the row does not name a range, so there is nothing to list");
  } else {
    lines.push(...workLines(await inspectLapWork(range)));
  }
  lines.push(...(await fenceLines(wording, continuo, record)));
  const readings = await store.readingsFor(record.id);
  const latest = readings.at(-1);
  if (latest === undefined) {
    lines.push(
      "review  no independent reading of this work was recorded.",
      "        'rondo publish' will refuse once on that, and --despite-review is the way past.",
    );
    return lines;
  }
  lines.push(...reviewLines(latest));
  return lines;
}

/**
 * What the lap was allowed to run, and what its fence refused (rondo#88).
 *
 * **Two facts the operator already owned and could not see**, printed next to
 * each other because neither answers "was this actually verified?" alone: a
 * refusal only means something against the allowance it was measured by, and an
 * allowance only means something beside what the run then hit. They go here --
 * in the block `rondo answer` and the page both render -- rather than into
 * `explain` or a verb of their own, because this is the one screen a person
 * reads immediately before pressing approve, and it is already the screen whose
 * purpose is to be the half of the gate the graded party did not write.
 *
 * **Every line says what rondo read and where from** (D-0032). The allowance is
 * not the plan on rondo's own row -- that is what rondo asked for -- but the
 * envelope continuo stored at admission, read back through `run show` beside the
 * digest continuo recomputed over it (D-0040). The refusals are continuo's own
 * `permission_denials`, carried to the row at the suspend and printed from it.
 *
 * **"None" and "not known" are never the same sentence**, on both halves. That
 * is `continuo D-1110`'s whole argument for the key being nullable, and the
 * three states of the column are spelled out on `IterationRecord`.
 *
 * **A third thing is said here and it is neither fact**: what this block does
 * not cover. It is `Chrome.secondFence`, which is where that sentence's own
 * argument for being unconditional is written down -- and, after D-0055
 * rule 11, the place it is also written in the operator's language.
 *
 * ponytail: one more `run show` per redraw, on top of the `gate show` that
 * `pageMaterial` already pays. Same ceiling and same upgrade as that one -- a
 * rondo-side column written at admission -- not taken now because the whole
 * value of this half is that the bytes come back from continuo.
 */
async function fenceLines(
  wording: Chrome,
  continuo: VerifiedContinuo | null,
  record: IterationRecord,
): Promise<readonly string[]> {
  const lines = [
    ...(await allowanceLines(wording, continuo, record)),
    ...denialLines(record),
    // Appended here rather than inside either half, which is what makes it
    // unconditional: neither the allowance's six answers nor the denials' five
    // can leave it out, and a later branch added to either cannot either.
    ...wording.secondFence,
  ];
  return lines.map((line, index) => (index === 0 ? `fence   ${line}` : `        ${line}`));
}

/** What the run was admitted as permitted to run, read back from continuo. */
async function allowanceLines(
  wording: Chrome,
  continuo: VerifiedContinuo | null,
  record: IterationRecord,
): Promise<readonly string[]> {
  if (record.runId === null) {
    return ["the row names no run, so there is no delegation record to read an allowance from."];
  }
  if (continuo === null) {
    return [
      `continuo is not usable here, so what run ${record.runId} was allowed to run was not`,
      "read. That is unknown rather than nothing.",
    ];
  }
  const observed = await showRun(continuo, { db: planField(record, "db"), runId: record.runId });
  if (observed.kind !== "answered") {
    return [
      `the delegation record for run ${record.runId} could not be read (${observed.kind}), so`,
      "what the lap was allowed to run is unknown rather than nothing.",
    ];
  }
  const stored = observed.payload.delegationRecord;
  if (stored === null) {
    return [
      `continuo holds no delegation record for run ${record.runId}, so what it was allowed to`,
      "run was never recorded.",
    ];
  }
  const subjects = allowedBashIn(stored.envelope);
  if (subjects === null) {
    return [
      `the delegation record for run ${record.runId} is '${stored.recordSchema}', which rondo`,
      "cannot read, so what the lap was allowed to run is unknown rather than nothing.",
    ];
  }
  const provenance = [
    `read from run ${record.runId}'s delegation record at continuo (${stored.recordSchema}).`,
    `envelope ${stored.digestAlgorithm} ${stored.envelopeDigest}`,
    "continuo re-checked that digest against the stored bytes: " +
      `${stored.digestVerified ? "it matches" : "IT DOES NOT MATCH"}.`,
    // **The declaration is not the fence, and saying so is the whole point of
    // the screen.** The sentence and its argument are `Chrome.declarationCaveat`
    // -- composed only on the paths where the delegation record was actually
    // read, which is why it is not beside `Chrome.secondFence` above.
    ...wording.declarationCaveat,
  ];
  if (subjects.length === 0) {
    return ["this run declared no Bash subject of its own.", ...provenance];
  }
  return ["declared for this run:", ...subjects.map((subject) => `  ${subject}`), ...provenance];
}

/**
 * What the fence refused, printed from the row rather than counted.
 *
 * Listed and not summarised for `workLines`'s reason: a count tells a person
 * that something was refused and leaves them where the worker's own prose left
 * them. The cap is `LIST_LIMIT` and says how many it hid. A call's input is the
 * worker's own text and may carry newlines, so it is rendered as a JSON string
 * -- on a line rondo composed, an embedded newline must not be ambiguous with
 * the line around it (rondo#68).
 */
function denialLines(record: IterationRecord): readonly string[] {
  const text = record.permissionDenials;
  if (text === null) {
    return ["what the fence refused was not recorded for this iteration, so it is unknown."];
  }
  if (text === "null") {
    return ["continuo could not say what the fence refused, so it is unknown rather than none."];
  }
  let denials: unknown;
  try {
    denials = JSON.parse(text);
  } catch {
    denials = null;
  }
  if (!Array.isArray(denials)) {
    return ["the recorded refusals will not decode, so what the fence refused is unknown."];
  }
  if (denials.length === 0) {
    return ["continuo reported that the fence refused nothing."];
  }
  const hidden = denials.length - LIST_LIMIT;
  return [
    `the fence refused ${String(denials.length)} call(s), as continuo reported them:`,
    ...denials.slice(0, LIST_LIMIT).map((denial) => `  ${denialLine(denial)}`),
    ...(hidden > 0 ? [`  ...and ${String(hidden)} more`] : []),
  ];
}

/** One refused call: the tool, and the input a reader acts on. */
function denialLine(denial: unknown): string {
  if (typeof denial !== "object" || denial === null || Array.isArray(denial)) {
    return "(a refusal rondo cannot read)";
  }
  const fields = denial as Readonly<Record<string, unknown>>;
  const name = fields["tool_name"];
  const input = fields["tool_input"];
  const command =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Readonly<Record<string, unknown>>)["command"]
      : undefined;
  return (
    `${typeof name === "string" ? name : "(unnamed tool)"}  ` +
    capped(JSON.stringify(typeof command === "string" ? command : input))
  );
}

/** How much of a worker's own text one line of the gate screen carries. */
const DENIAL_TEXT_LIMIT = 200;

/** Say that a value was cut rather than trailing off, as `workLines` does. */
function capped(text: string): string {
  return text.length <= DENIAL_TEXT_LIMIT
    ? text
    : `${text.slice(0, DENIAL_TEXT_LIMIT)}... (${String(text.length)} chars)`;
}

/**
 * What the lap committed, listed rather than counted.
 *
 * **An unreadable workspace prints and does not refuse.** This runs on the path
 * to a person's gate answer, where D-0029 rule 3 refuses to let anything of
 * rondo's stand between them and it: a workspace that has been moved or removed
 * since the lap ran is worth saying out loud and is not worth withholding the
 * gate over.
 *
 * Capped at `LIST_LIMIT` for the reason the pull-request body is, and saying
 * how many were hidden rather than trailing off -- a list that stops without
 * saying it stopped is a list a person reads as complete.
 */
export function workLines(work: LapWorkInspection): readonly string[] {
  if (work.kind !== "read") {
    return [`        the workspace could not be read: ${work.reason}`];
  }
  const lines = [`        against ${work.baseRef}`];
  if (work.commits.length === 0) {
    lines.push("        no non-merge commits on the branch");
  } else {
    for (const commit of work.commits.slice(0, LIST_LIMIT)) {
      lines.push(`        ${commit.abbreviatedSha} ${commit.subject}`);
    }
    const hiddenCommits = work.commits.length - LIST_LIMIT;
    if (hiddenCommits > 0) {
      lines.push(`        ...and ${String(hiddenCommits)} more commit(s)`);
    }
  }
  if (work.files.length === 0) {
    lines.push("        no files changed");
    return lines;
  }
  for (const file of work.files.slice(0, LIST_LIMIT)) {
    lines.push(`        ${file.path} ${fileCounts(file)}`);
  }
  const hiddenFiles = work.files.length - LIST_LIMIT;
  if (hiddenFiles > 0) {
    lines.push(`        ...and ${String(hiddenFiles)} more file(s)`);
  }
  return lines;
}

/**
 * The range a reading of this row was taken across, or null when the row does
 * not name one.
 *
 * **One definition, read by both ends of D-0029 rule 10's comparison**, and it
 * exists because getting it wrong is invisible in the ordinary case and routine
 * in the revision case. `publish` compares against `pull_request_base_branch`
 * when a revision set one -- the first lap's base, carried along the chain --
 * while the reading was taken against `base_branch`, the predecessor's topic
 * branch. Two different ranges compared against each other report every
 * unchanged revision as stale, which sends the operator to `--despite-review`
 * as a habit and costs the stage the only force it has.
 */
export function readingRangeOf(record: IterationRecord): LapWorkRequest | null {
  const workspace = planField(record, "workspace");
  const topicBranch = planField(record, "topic_branch");
  const baseBranch = planField(record, "base_branch");
  if (workspace === "" || topicBranch === "" || baseBranch === "") {
    return null;
  }
  return { workspace, remote: READING_REMOTE, baseBranch, topicBranch };
}

/**
 * One stored reading, as an operator reads it. ASCII, one line at a time
 * (D-0004).
 *
 * **What it did not look at is printed beside what it found** (rondo#69). The
 * headline used to be `read and nothing raised`, which is a claim about
 * coverage that this reader has no standing to make: it read commit subjects
 * and per-file counts, and on 2026-09-12 it said that under a gate whose own
 * `rationale` reported that the verification could not be run at all. The two
 * blocks are printed by the same command, and only the person spotted that they
 * disagreed. `readingCoverage` is the store's, so this screen and the
 * conductor's report say the same thing about the same drafter.
 *
 * **`unavailable` gets no coverage lines**, because nothing was read and the
 * branch already says so. Stating what an absent reading did not look at would
 * dress an absence up as a bounded check.
 */
export function reviewLines(reading: LapReading): readonly string[] {
  const evidence = reading.evidence;
  const coverage = readingCoverage(reading.drafter).map((line) => `        ${line}`);
  switch (reading.verdict) {
    case "clear":
      return [
        `review  read the commits and the files, and raised nothing (${reading.drafter}).`,
        `        ${String(evidence?.commitCount ?? 0)} commit(s), ` +
          `${String(evidence?.fileCount ?? 0)} file(s), tip ${evidence?.tipCommit ?? "(none)"}.`,
        ...coverage,
        "        This is material for you. It is not an approval and it permits nothing.",
      ];
    case "concerns":
      return [
        `review  ${String(reading.findings.length)} point(s) raised (${reading.drafter}):`,
        ...reading.findings.map((finding) => `        - ${finding}`),
        ...coverage,
        "        Material for you to weigh. The answer is still yours.",
      ];
    default:
      return [
        "review  no reading could be taken: " +
          `${reading.unavailableReason ?? "no reason recorded"}`,
        "        'rondo publish' refuses on this exactly as it does on a point raised, so that " +
          "unread",
        "        and read-and-fine cannot look alike.",
      ];
  }
}

/**
 * Whether the recorded reading lets `publish` run without being overruled.
 *
 * **Pure, and over both halves of the comparison**, for the reason
 * `publishPreflight` is pure over a `PushTargetInspection`: which readings may
 * publish is a rule about publishing rather than a fact about git, and a rule
 * that can be exercised without a repository on disk is a rule a test can hold.
 *
 * Three refusals and one pass, and the third refusal is the one that is easy to
 * miss. A reading is about the commits it read; `publish` pushes the branch as
 * it is *now*. Between the two, somebody can commit into the worktree, amend or
 * reset it -- and a reset onto the base is exactly the case the reader's own
 * "left nothing" finding exists to raise, arriving under a stale `clear` that
 * would carry it through (D-0029 rule 10).
 */
export function reviewGate(
  reading: LapReading | null,
  work: LapWorkInspection,
  despiteReview: boolean,
): { readonly kind: "ready" } | { readonly kind: "refused"; readonly reason: string } {
  const overruled = { kind: "ready" } as const;
  if (reading === null) {
    return despiteReview
      ? overruled
      : {
          kind: "refused",
          reason:
            "no independent reading of this work was recorded, so publishing it would put " +
            "work in front of the world that nothing read. That is the same refusal a reading " +
            "which raised something gets, on purpose: unread and read-and-fine must not look " +
            "alike. Pass --despite-review to publish anyway.",
        };
  }
  if (reading.verdict !== "clear") {
    return despiteReview
      ? overruled
      : {
          kind: "refused",
          reason:
            `the independent reading of this work is '${reading.verdict}'` +
            `${reading.findings.length === 0 ? "" : `: ${reading.findings.join("; ")}`}` +
            `${reading.unavailableReason === null ? "" : `: ${reading.unavailableReason}`}. ` +
            "It settles nothing and it is not a veto; it is a point you have not answered. " +
            "Pass --despite-review to publish anyway.",
        };
  }
  const evidence = reading.evidence;
  if (evidence === null) {
    // Unreachable through the store, which records a clear with no evidence as
    // `unavailable` instead (D-0029 rule 11). Refused rather than trusted all
    // the same: a clear whose evidence is missing is a clear nothing can be
    // compared against, and the branch below is the only one that would be
    // silently skipped if it ever became reachable.
    return despiteReview
      ? overruled
      : {
          kind: "refused",
          reason:
            "the recorded reading is 'clear' but carries no measurement of what was read, so " +
            "there is nothing to check it against. Pass --despite-review to publish anyway.",
        };
  }
  if (work.kind !== "read") {
    return despiteReview
      ? overruled
      : {
          kind: "refused",
          reason:
            `the workspace cannot be read now (${work.reason}), so the recorded reading cannot ` +
            "be checked against what would be pushed. Pass --despite-review to publish anyway.",
        };
  }
  const now = evidenceOf(work);
  if (now.tipCommit !== evidence.tipCommit || now.materialDigest !== evidence.materialDigest) {
    return despiteReview
      ? overruled
      : {
          kind: "refused",
          reason:
            `the reading was taken over ${evidence.tipCommit} and this would push ` +
            `${now.tipCommit}, so it does not describe the work any more. Read it again, or ` +
            "pass --despite-review to publish anyway.",
        };
  }
  return overruled;
}

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
  // **A terminal row is refused before its gate is read** (`D-0023` rule 15).
  // `pickWaiting` applies no status filter on purpose, because `publish` acts
  // on `closed` rows and has to be able to name one -- but `answer` must not
  // inherit that latitude. `abandon` writes a terminal row and deliberately
  // drives no continuo verb, so an abandoned iteration usually still has an
  // open gate on it; answering that gate would close a run whose iteration a
  // person has already ended, and would record a human answer against work
  // rondo had given up on. Before D-0023 this was unreachable because there was
  // no `--iteration-id` on `answer` at all.
  if (isTerminal(record.status)) {
    return refuse(
      `iteration '${record.id}' is ${record.status}, which is terminal, so there is nothing ` +
        "left to answer. Its gate may still be open -- closing that is a person's, through " +
        "'gate close' on the operating surface (D-0013).",
    );
  }
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

  // **`--verified` without `--body` is refused rather than read past.** The
  // reading mode answers nothing, so there is no act for a claim to go before
  // and nothing would be written -- and a flag that reads as though it did
  // something is worse than one that is rejected, which is the rule
  // `parseCommand` already states about every flag rondo takes. Silently
  // dropping it would leave an operator believing the record holds what they
  // checked, and `publish` saying nobody recorded anything.
  if (parsed.verified !== null && parsed.body === null) {
    return refuse(
      "--verified says what you checked before answering, and without --body nothing is being " +
        "answered, so there is nothing to record it against. Give both, or neither.",
    );
  }
  if (parsed.body === null) {
    // The reading mode: what is being asked, and the command that answers it.
    say(`iteration '${record.id}' is ${record.status}`);
    say(`run     ${record.runId ?? "(none recorded)"}`);
    // **Where a person meets the lineage** (D-0030 rule 4). A revision's work
    // is the predecessor's plus a delta, so "what am I looking at" has a
    // different answer for a second lap than for a first -- and before the
    // column the only way to learn it here was to notice that the base branch
    // looked like somebody's topic branch. Printed only when there is one, so
    // an ordinary lap's screen is unchanged.
    if (record.supersedesIterationId !== null) {
      say(`revises ${record.supersedesIterationId}`);
    }
    say(`gate    ${gate.gateId}  (${gate.gateType})  stage '${gate.stage}'`);
    sayLegible(`why     ${gate.rationale}`);
    say(`options ${gate.options}`);
    // **`why` is the worker's account of its own work; what follows is not.**
    // The two are printed adjacently on purpose, so that a person can see which
    // of them is the graded party speaking (D-0029 rule 2).
    await sayLapMaterial(store, record, continuo);
    say("");
    say("to answer:");
    // **The id is always printed, not only when several are open.** A command
    // that is correct today and refused tomorrow -- because somebody started a
    // second iteration in between -- is worse than one that is always explicit,
    // and since D-0023 "the live one" stops naming anything the moment a second
    // iteration is admitted.
    say(`  rondo answer --iteration-id ${record.id} --actor-id YOU --body="your answer"`);
    return 0;
  }

  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  if (parsed.body === "") {
    return refuse(
      "--body is empty. An answer is carried byte for byte, and there is nothing to carry.",
    );
  }
  if (parsed.verified === "") {
    return refuse(
      "--verified is empty. It records what you checked, and an empty claim would put a row " +
        "in the ledger saying a verification was declared and not saying what it was. Leave " +
        "the flag off if you did not run anything.",
    );
  }

  say(`gate ${gate.gateId} is at stage '${gate.stage}'`);
  // **A receipt, and the code says so because the difference matters.** The
  // answer is already typed and `walkGate` below takes no further input, so
  // this cannot inform the decision the way the reading path's copy does. What
  // it does is leave the person holding a record of what they approved over.
  await sayLapMaterial(store, record, continuo);
  // **The claim is written before the gate is walked, and a write that fails
  // stops the answer** -- `D-0042` rule 3's order, for its reason: a record
  // written after the act it describes is one an operator can act past. It is
  // recorded as the operator's own account and never as rondo's: rondo did not
  // run this and has no way to check it, so the row holds who said it and what
  // they said, and every reader of it says whose word it is (#70).
  //
  // **Not on a gate that is already closed.** `walkGate` sends nothing for one
  // of those and says so, so a claim written here would sit on the row saying a
  // person checked the work before answering a gate they did not answer -- the
  // exact false attribution this record exists to make impossible. The gate
  // rondo already read is what decides it, and the answer is said out loud
  // rather than dropped.
  if (parsed.verified !== null && gate.outcome !== null) {
    say(
      `Gate ${gate.gateId} is already closed as '${gate.outcome}', so what you said you ` +
        "verified was not recorded: nothing here is being answered.",
    );
  } else if (parsed.verified !== null) {
    try {
      await store.recordVerificationClaim(record.id, actor.actorId, parsed.verified, Date.now());
    } catch (error) {
      return refuse(
        `what you said you verified was not recorded, so nothing was answered: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
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
 * Everything a person is shown before they may press: the question, then the work.
 *
 * **The gate's own words come first, and they are not in rondo's store.** The
 * rationale is the worker's account of why it stopped, and the options are what
 * it was asked -- `commandAnswer`'s reading mode prints both above the material,
 * and a page offering approval without them would be offering approval of a
 * question nobody read. Only continuo has them, so this reads one `gate show`.
 *
 * **A continuo that will not start is a line and never a refusal**, which is
 * `inspectLapWork`'s treatment of an unreadable workspace and the same argument:
 * `web` is dispatched ahead of `startContinuo` so that the screen saying what is
 * stuck stays reachable when continuo is one of the stuck things, and a render
 * that threw on it would undo that. What the person loses is the question, and
 * they are told that is what they lost -- so a press on a page that says the
 * question could not be read is a press made knowingly.
 *
 * ponytail: one `gate show` per open gate per redraw, which at five seconds is a
 * subprocess every five seconds for each row with a button. Acceptable while the
 * host has one operator and a handful of live laps; the upgrade is a rondo-side
 * column holding the question, written when the row reaches `awaiting_human`.
 */
async function pageMaterial(
  wording: Chrome,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  record: IterationRecord,
): Promise<readonly string[]> {
  const lines: string[] = [];
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    lines.push("why     the gate question could not be read: continuo is not usable");
    lines.push(`        ${startup.reason}`);
  } else if (record.gateId !== null) {
    const observed = await showGate(startup.continuo, {
      db: planField(record, "db"),
      gateId: record.gateId,
    });
    if (observed.kind === "answered") {
      const gate = observed.payload;
      lines.push(`gate    ${gate.gateId}  (${gate.gateType})  stage '${gate.stage}'`);
      // Not `legibleAsciiEscape`d: that exists because a cp932 console may not
      // encode what a worker wrote, and a browser has no such problem. The
      // paragraphs survive, which is rondo#90 on the path that matters most.
      lines.push(`why     ${gate.rationale}`);
      lines.push(`options ${String(gate.options)}`);
    } else {
      lines.push(`why     the gate question could not be read (${observed.kind})`);
    }
  }
  return [
    ...lines,
    ...(await lapMaterialLines(
      wording,
      store,
      record,
      startup.kind === "refused" ? null : startup.continuo,
    )),
  ];
}

/**
 * Where a running lap is writing, for the in-flight row of the inbox (D-0048).
 *
 * **The continuo handle is started at most once per look and only if a lap is
 * actually running.** `inbox` and `web` are both dispatched ahead of
 * `startContinuo` so that the screen saying what is stuck stays reachable when
 * continuo is what is stuck, and a port that started one eagerly would undo
 * that; a host with nothing `performing` spawns nothing at all.
 */
export function transcriptPort(
  environment: Readonly<Record<string, string | undefined>>,
): (record: IterationRecord) => Promise<TranscriptLocation> {
  let verified: VerifiedContinuo | null = null;
  return async (record) => {
    const stateRoot = planField(record, "state_root");
    if (stateRoot === "") {
      return { kind: "unknown", reason: "the row's plan names no state root" };
    }
    if (record.runId === null) {
      return { kind: "unknown", reason: "the row names no run" };
    }
    // **The row first, and continuo only for the window where the row is
    // empty** (D-0048 rule 6). A row that already carries a session needs no
    // subprocess to name its directory, and asking anyway would spend one to
    // learn what rondo wrote down itself.
    if (record.sessionId !== null) {
      return {
        kind: "named",
        directory: lapTranscriptDirectory({
          stateRoot,
          runId: record.runId,
          sessionId: record.sessionId,
        }),
        sessions: 1,
      };
    }
    // **A working handle is remembered and a refusal is not.** The page is the
    // caller that lives: it is built once and redraws itself every few seconds,
    // so a startup cached after it failed would keep saying "continuo is not
    // usable" long after continuo came back -- a stale answer on the one
    // surface D-0048 rule 4's "read at render time" has to keep honest. The
    // retry costs a `--version` per running lap while continuo is down, which
    // is the same bound rule 6 already accepts and is paid only when the answer
    // is unknown anyway.
    if (verified === null) {
      const startup = await startContinuo(environment);
      if (startup.kind === "refused") {
        return { kind: "unknown", reason: `continuo is not usable here: ${startup.reason}` };
      }
      verified = startup.continuo;
    }
    const observed = await showRun(verified, {
      db: planField(record, "db"),
      runId: record.runId,
    });
    if (observed.kind !== "answered") {
      return {
        kind: "unknown",
        reason: `run ${record.runId} could not be read (${observed.kind})`,
      };
    }
    const sessions = observed.payload.sessions;
    // **Newest by `bound_at_ms`, and nothing filtered on `released_at_ms`**
    // (D-0048 rule 8): that column is one continuo writes nowhere, so a filter
    // over it would quietly be no filter at all.
    const newest = sessions.reduce<ObservedSession | null>(
      (best, session) => (best === null || session.boundAtMs > best.boundAtMs ? session : best),
      null,
    );
    if (newest === null) {
      return { kind: "unknown", reason: `continuo holds no session for run ${record.runId} yet` };
    }
    return {
      kind: "named",
      directory: lapTranscriptDirectory({
        stateRoot,
        runId: record.runId,
        sessionId: newest.sessionId,
      }),
      sessions: sessions.length,
    };
  };
}

/**
 * The framing a press rests on, recorded before the press is acted on (D-0042).
 *
 * **It is `explain`'s own writer and not a second one.** The page composed its
 * claims with `propose`, which is what {@link explainIteration} composes; a
 * second path to the same rows would be two things to keep agreeing. What
 * differs is only where the lines go: the page rendered them up to five seconds
 * ago, so `present` drops them here rather than printing a copy to the terminal
 * `rondo web` happens to be running in.
 *
 * **The press is what makes it a presentation** (D-0042 rule 1). An unattended
 * redraw reaches none of this -- it is a `GET`, and only the `POST` path a
 * person's click produces gets here -- so `operator_attention` counts a row for
 * a human who pressed and never for a page redrawing at an empty desk.
 *
 * **A framing recorded and not counted does not withhold the gate.** That is
 * `sayAdvisoryOutcome`'s treatment of the same outcome -- the record is kept and
 * what was shown still stands -- differing only in where the complaint goes: a
 * command exits **1**, and a person at a browser cannot read an exit status, so
 * the line is said in the terminal `rondo web` runs in, beside the other two
 * things this surface already says there (`walkGate`'s diagnostics and
 * `sayReport`). Refusing the press instead would stop an operator answering a
 * gate over rondo's own accounting, which is a worse failure than an
 * under-counted table (D-0032 rule 10).
 */
export async function recordPagePress(
  ports: ExplainPorts,
  iterationId: string,
  complain: (line: string) => void = say,
): Promise<{ ok: boolean; note: string }> {
  const shown = await explainIteration(ports, iterationId);
  if (shown.kind === "refused") {
    return {
      ok: false,
      // `explainIteration`'s own reason ends with why this matters, so this
      // adds the half it cannot know: on a page the framing was shown before
      // the press, and what the failure costs is the *act*, not the showing.
      note: `The framing you pressed on was not recorded, so nothing was answered. ${shown.reason}`,
    };
  }
  if (shown.kind === "presentedUncounted") {
    complain(
      `proposal '${shown.proposalId}' was recorded and not counted as presented: ` +
        `${shown.reason}. The press went through; operator_attention is short by one row.`,
    );
  }
  return { ok: true, note: "" };
}

/**
 * One press of the page's approve button, in the terminal's own verbs.
 *
 * **It is `commandAnswer`'s writing half over a row it did not parse for.**
 * `walkGate` and `resume` are reached here by the same two calls the command
 * line makes, so "the button does what `rondo answer` does" is a property of
 * there being one implementation rather than two that have to keep agreeing
 * (D-0041 rule 7). What differs is only what a screen can do with the answer: a
 * refusal is a sentence handed back to be rendered rather than a line printed
 * and an exit status returned, because the person who pressed the button is
 * looking at a browser and not at this process's stdout.
 *
 * **continuo is started here rather than before the page is served**, and that
 * is `dispatch`'s existing reasoning rather than a new one: `web` is dispatched
 * ahead of `startContinuo` so that a screen which says what is stuck stays
 * reachable when continuo is one of the stuck things. A press is the first
 * moment this surface actually needs a continuo, and a start that fails is a
 * refusal on the page instead of a page that never appeared.
 */
async function answerFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  iterationId: string,
  body: string,
): Promise<{ ok: boolean; note: string }> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, note: actor.refusal };
  }
  const found = await store.read(iterationId);
  if (found.kind === "absent") {
    return { ok: false, note: `There is no iteration '${iterationId}'.` };
  }
  if (found.kind === "unreadable") {
    return { ok: false, note: `That iteration row would not read: ${found.reason}` };
  }
  const record = found.record;
  // The same two refusals `commandAnswer` makes, for the same reasons: a
  // terminal row's gate is not this surface's to close (`D-0023` rule 15), and
  // a row with no gate id has nothing for a person to answer. The button is not
  // drawn in either case -- these catch a stale page, which is exactly what a
  // page that redraws itself every five seconds will sometimes be.
  if (isTerminal(record.status)) {
    return {
      ok: false,
      note:
        `iteration '${record.id}' is ${record.status}, which is terminal, so there is nothing ` +
        "left to answer.",
    };
  }
  if (record.gateId === null) {
    return {
      ok: false,
      note: `iteration '${record.id}' is ${record.status}, and no gate is open on it.`,
    };
  }
  // **Written before the press acts on it** (D-0042 rules 2 and 3). Here rather
  // than at the top of this function so that the three refusals above -- which
  // are a stale page rather than a person answering -- do not each put a
  // framing in the ledger that nobody acted on.
  const shown = await recordPagePress(
    advisoryPorts(store, storePath, () => {}),
    iterationId,
  );
  if (!shown.ok) {
    return shown;
  }
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return { ok: false, note: `continuo is not usable: ${startup.reason}` };
  }
  const continuo = startup.continuo;
  const walked = await walkGate(continuo, {
    db: planField(record, "db"),
    gateId: record.gateId,
    destinationDir: planField(record, "endpoint_destination_dir"),
    holder: planField(record, "lease_claimant_id"),
    actorId: actor.actorId,
    body,
  });
  if (walked.kind === "failed") {
    // The relay's own words went to the terminal `rondo web` is running in --
    // `walkGate` says what it did as it does it, and this surface does not
    // intercept that. Said here rather than silently redirecting, because the
    // page would otherwise redraw showing the same open gate and no reason.
    return {
      ok: false,
      note:
        `The gate walk for '${record.id}' did not finish. The terminal running 'rondo web' has ` +
        "continuo's own diagnosis.",
    };
  }
  const report = await resume(conductorPorts(continuo, store), record.id);
  sayReport(report);
  // **A walk that closed the gate and a row that settled are two facts**, and
  // `resume` is total: a gate it cannot observe comes back as a report with
  // diagnostic lines rather than as a throw. Redirecting on that would put the
  // operator back on a page still offering the button, with the answer already
  // spent and nothing saying why -- so the report's own lines are the response.
  if (report.status !== "closed") {
    return {
      ok: false,
      note: [
        `The gate was answered, but iteration '${record.id}' is ` +
          `${report.status ?? "in an unnamed state"} rather than closed.`,
        ...report.lines,
      ].join("\n"),
    };
  }
  return { ok: true, note: `iteration '${record.id}' is closed` };
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
 *  2. **The successor's run id is asked of continuo's control plane**, which is
 *     the one field `run admit` checks that rondo's own store cannot see. Under
 *     `D-0023` the run id is a pure function of the iteration id, so a
 *     collision rondo caused is impossible and check (1) covers the rest of
 *     rondo's own history -- but a control plane holding a run rondo's store
 *     does not (a store rebuilt or replaced, a `--db` pointing somewhere else,
 *     a run made by hand) still refuses at `run admit`, which for a revision is
 *     after the gate is gone. **Only an answered `run show` counts as taken**;
 *     a refusal, an unreadable database or a seam that did not answer leaves
 *     this command behaving exactly as it did before the check existed, which
 *     is what keeps a verb rondo drives to learn about an absence from turning
 *     continuo's refusal vocabulary into a taxonomy (`D-0015` rule 2).
 *  3. **The topic branch and the workspace are asked of the machine, not only
 *     of the predecessor's plan.** `revisionPlan` compares the three
 *     identifiers against the predecessor's, which catches the obvious reuse
 *     and is all a layer that may not start a process can do. It does not catch
 *     a branch from two laps ago, a branch something else created, or another
 *     spelling of a path that resolves to the same directory -- and continuo's
 *     materialiser requires that neither exists, discovering it after
 *     `run admit`, which for a revision is after the gate is gone.
 *  4. **A gate continuo has already closed is not an answer this command may
 *     stand on.** `walkGate` handles it correctly and gently -- it says so and
 *     sends nothing -- and that is exactly the trap: the walk *succeeds*, and a
 *     conductor's `resume` then reports `closed` for `withdrawn` and `expired`
 *     as readily as for `answered_and_forwarded`. Read as permission, a
 *     successful no-op walk would start a lap whose instruction was never
 *     recorded anywhere, under a gate outcome that is not a person saying
 *     anything at all.
 *
 * All four were found by review rather than by a walk, which is the half of the
 * ordering argument the first walk could not reach: the happy path never meets
 * any of them.
 */
export function revisionBlocker(input: {
  readonly predecessorId: string;
  readonly gateOutcome: string | null;
  readonly successorId: string;
  readonly successorRow: ReadOutcome["kind"];
  readonly successorRunId: string;
  readonly successorRunStatus: string | null;
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
      "touched. Choose another --iteration-id."
    );
  }
  if (input.successorRunStatus !== null) {
    return (
      `continuo's control plane already holds run '${input.successorRunId}' at status ` +
      `'${input.successorRunStatus}', and admission refuses a second run under one id -- the ` +
      "second lap could not have been admitted, and the gate would have been answered first. " +
      "Nothing was touched. rondo derives the run id from the iteration id, so choose another " +
      "--iteration-id."
    );
  }
  if (input.topicBranchExists) {
    return (
      `branch '${input.topicBranch}' already exists in the repository, and continuo creates the ` +
      "topic branch rather than checking it out -- it requires one that is not there. Nothing " +
      "was touched. rondo derives the topic branch from the iteration id, so choose another " +
      "--iteration-id."
    );
  }
  if (input.workspaceExists) {
    return (
      `'${input.workspace}' already exists, and continuo creates the worktree there -- it ` +
      "requires the path not to exist. Nothing was touched. rondo derives the workspace from " +
      "the iteration id, so choose another --iteration-id."
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
  advisory: UnpromptedPorts,
  continuo: VerifiedContinuo,
): Promise<number> {
  const actor = approvedActor(parsed.actorId, environment);
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
  // **Asked of continuo, and only an answer is a fact.** This is the field
  // `D-0027` rule 9 left open: `run admit` refuses a run id the control plane
  // already holds, and for a revision that refusal arrives after the gate is
  // spent. An answered document means the id is taken; every other outcome --
  // continuo refusing, a database rondo cannot read, a seam that did not answer
  // -- leaves this command as it was, because a verb driven to learn about an
  // absence must not turn continuo's refusals into a taxonomy (`D-0015`
  // rule 2). The database is the predecessor's own, which `gate show` has just
  // read successfully.
  const successorRun = await showRun(continuo, {
    db: planField(record, "db"),
    runId: allocation.allocation.runId,
  });
  const blocker = revisionBlocker({
    predecessorId: record.id,
    gateOutcome: gate.outcome,
    successorId,
    successorRow: existing.kind,
    successorRunId: allocation.allocation.runId,
    successorRunStatus: successorRun.kind === "answered" ? successorRun.payload.status : null,
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
  // **The predecessor's id travels beside the plan, not inside it** (D-0030
  // rule 1). It is the one place in rondo that knows this lap is a revision of
  // that one at the moment the row is written, and until this argument existed
  // the succession survived only as `base_branch` equalling the predecessor's
  // `topic_branch` -- a value a reader could guess a relationship from, which
  // is what `D-0027` rule 9 deferred and rondo#33 asked for.
  const second = await admit(ports, advisory, successor.plan, START_POLICY, successorId, record.id);
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
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }

  // **`publish` names its iteration and never infers it.** It acts on a
  // `closed` row, and a closed row is terminal and therefore never in the live
  // set -- so there has never been anything for the no-id path to find. Before
  // D-0023 that path answered "no iteration is live", which was confusing but
  // harmless. With more than one iteration open it would instead have selected
  // an unrelated *live* one and refused with a sentence about it, naming an
  // iteration that has nothing to do with what the operator meant to publish.
  // `answer` prints the id, so it is always to hand.
  if (parsed.iterationId === null) {
    return refuse(
      "publish needs --iteration-id ID. It publishes an iteration a person has already " +
        "approved at the gate, and an approved iteration is closed -- so it is never the one " +
        "that is 'live' and cannot be guessed from what is. 'rondo answer' prints the id.",
    );
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
  // **The predecessor is read, not assumed** (#132). Whether that lap's commits
  // are on this branch is a fact about its row, and since D-0047 a predecessor
  // is as likely to be a retry's abandoned subject as a revision's answered
  // one. A row that will not read is left as null and said out loud, because a
  // missing predecessor is not evidence for either lineage.
  const predecessorRead =
    record.supersedesIterationId === null ? null : await store.read(record.supersedesIterationId);
  const pullRequest = pullRequestText({
    record,
    runId,
    topicBranch,
    baseBranch,
    headIsQualified: headRef !== topicBranch,
    work,
    predecessor:
      predecessorRead !== null && predecessorRead.kind === "read" ? predecessorRead.record : null,
    verificationClaims: await store.verificationClaimsFor(record.id),
  });

  // **Before the first line is printed, and therefore before `--dry-run`
  // returns.** The ordering doctrine this file already states for the preflight
  // is that a preview must not pass where the real run would fail; a review
  // refusal a dry run hid would be the same defect with a different cause.
  const readings = await store.readingsFor(record.id);
  // **A second inspection, over the range the *reading* was taken across.**
  // `work` above is built for the pull request, which after `rondo revise` is a
  // different range: `publish` compares against `pull_request_base_branch` --
  // the first lap's base, carried along the chain -- while the reader saw
  // `base_branch`, the predecessor's topic branch. The material digest covers
  // the base ref, the base commit, the commits and the files, so comparing the
  // two would report every unchanged revision as stale and send the operator to
  // `--despite-review` as a matter of routine. That is this design's own
  // falsifier fired on the first day, and the fix is one query rather than a
  // looser comparison.
  const range = readingRangeOf(record);
  const asRead: LapWorkInspection =
    range === null
      ? { kind: "unreadable", reason: "the row does not name the range a reading was taken across" }
      : await inspectLapWork(range);
  const gateOnReview = reviewGate(readings.at(-1) ?? null, asRead, parsed.despiteReview);
  if (gateOnReview.kind === "refused") {
    return refuse(gateOnReview.reason);
  }

  say(`iteration '${record.id}' is closed; gate outcome '${record.gateOutcome ?? "(none)"}'`);
  if (parsed.despiteReview) {
    // Printed rather than silent: an override that leaves no trace on the run
    // that used it is an override nobody can audit afterwards, and the reading
    // it overrode is in the store either way.
    say("");
    say(
      "--despite-review: publishing without a clean reading of this work. That is yours to " +
        "decide; rondo is recording that you decided it.",
    );
  }
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
 * How much of a verification claim the body carries.
 *
 * **`listed()`'s replacement rule does not reach this field.** A commit subject
 * or a path is replaced rather than cut because the thing itself is right there
 * to read; a claim's only destination is this body, and the row it was written
 * to is in a database no reviewer of this pull request can open. Replacing it
 * printed a sentence meaning *something was said and you may not see it*, to the
 * one reader it was written for (#131).
 *
 * So it is bounded the way the quoted request is bounded, and for that reason:
 * the cut says how much it left and where the whole of it still is, which is the
 * difference between a truncation and a loss. Below this -- which is every claim
 * a person types at a terminal -- the words are printed byte for byte, as
 * `D-0045` rule 1 recorded them.
 */
const CLAIM_LIMIT = 4000;

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
  /**
   * The row `supersedesIterationId` names, read; null when there is no
   * predecessor or when its row would not read.
   *
   * **Read rather than inferred, because the column now has two meanings.**
   * Until #126 a predecessor meant `rondo revise`; since D-0047 it also means
   * `rondo retry`, and the two lineages reach this branch by different routes.
   * What separates them is a fact only the predecessor's row holds, so
   * `publish` reads it rather than deciding from the column being non-null
   * (D-0032: rondo says what it read).
   */
  readonly predecessor: IterationRecord | null;
  /**
   * What the operator said they ran before answering the gate (#70). Empty when
   * they said nothing, which is what it means and not more than that.
   */
  readonly verificationClaims: readonly OperatorVerificationClaim[];
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
 * `LIST_LIMIT`, each listed or row-carried value by `LISTED_LIMIT`, a
 * verification claim by `CLAIM_LIMIT`, the request by `REQUEST_LIMIT` -- and
 * this is the check that the sum is bounded too. It
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
  if (record.supersedesIterationId !== null) {
    // **The lineage, stated rather than left to the branch names** (D-0030
    // rule 4). It sits above the gate sentence because "which gate closed
    // this" is about the last lap and this is about all of them.
    lines.push(`- ${lineageSentence(record, input.predecessor)}`);
  }
  lines.push(`- ${gateSentence(record)}`);
  lines.push(...verificationLines(input.verificationClaims));
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

/**
 * Which iteration this one supersedes, and whether that lap's work is under
 * this pull request.
 *
 * **Two spellings, because `supersedesIterationId` has two meanings** (#132).
 * `rondo revise` cuts the successor from the predecessor's own topic branch, so
 * the predecessor's commits are on the branch being merged and a reviewer must
 * be told. `rondo retry` (D-0047) starts a fresh lap from the same base the
 * subject started from -- the subject may have been abandoned before a
 * workspace existed, its branch may never have been materialised, and the
 * person answered a *proposal* rather than a gate. One sentence for both said
 * all of that about a retry and every clause of it was false.
 *
 * **The question that separates them is asked of the two rows, not of the
 * verb**, which `publish` cannot see: was this lap cut from the branch that lap
 * ran on? Both halves are read -- this row's plan and the predecessor's
 * `topicBranch` -- so neither spelling claims anything rondo did not look at
 * (D-0032). A predecessor that will not read gets a third sentence saying so,
 * rather than the benefit of either doubt.
 */
function lineageSentence(record: IterationRecord, predecessor: IterationRecord | null): string {
  const id = listed(record.supersedesIterationId ?? "", "id");
  if (predecessor === null) {
    return (
      `It supersedes iteration \`${id}\`, whose row rondo could not read here, so this body does ` +
      "not say whether that lap's work is on this branch."
    );
  }
  // The branch this lap was cut from, which after `revise` is the predecessor's
  // topic branch and is not the base the pull request is opened against (see
  // `pull_request_base_branch` above).
  const cutFrom = planField(record, "base_branch");
  if (predecessor.topicBranch !== null && predecessor.topicBranch === cutFrom) {
    return (
      `It revises iteration \`${id}\`: this lap was cut from \`${listed(cutFrom, "branch name")}\`, ` +
      "the branch that lap ran on, so whatever that lap committed is on this branch too."
    );
  }
  return (
    `It supersedes iteration \`${id}\`, which ended \`${listed(predecessor.status, "status")}\`: ` +
    `this lap was cut from \`${listed(cutFrom, "branch name")}\` rather than from that lap's own ` +
    "branch, so nothing it left is carried here."
  );
}

/**
 * What the operator said they checked, or the fact that they said nothing (#70).
 *
 * **Both branches are printed, and the silent one is the reason this exists.**
 * The gate sentence above says a person answered; on its own it reads the same
 * whether they ran the suite first or read the diff, and those are the two
 * cases the record is for. So the absence is written out rather than left as a
 * missing bullet, which a reviewer cannot tell from a section that was never
 * composed.
 *
 * **It is attributed, not asserted.** rondo did not run what these rows name
 * and did not watch them run, so the line says whose account it is; anything
 * shorter would put rondo's name on a verification it never observed.
 *
 * **It dates the claim to the walk and not to the answer**, because those come
 * apart: a walk that fails after the claim is written leaves a row beside a
 * gate that was answered later, or not at all. Saying "before rondo walked the
 * gate" is true of every row this table can hold; "as they answered" would be a
 * second claim, about the walk, that this record has not checked.
 */
function verificationLines(claims: readonly OperatorVerificationClaim[]): readonly string[] {
  if (claims.length === 0) {
    return [
      "- Nobody recorded what they checked before answering, so this body cannot say whether " +
        "the work was run or only read.",
    ];
  }
  return claims.flatMap(claimBullet);
}

/**
 * One claim as a bullet, with a multi-line claim quoted under it (rondo#140).
 *
 * **A claim with a newline in it is not one line of a list.** Rendered inside
 * the bullet, its second line onwards leaves the bullet and the section's
 * structure breaks around it -- which is rondo#90 arriving at the other screen:
 * there a multi-paragraph request was folded into one escaped line, and PR #94
 * gave it the width of its own lines. A claim is the other free text an
 * operator types and this body is its only screen, so it is quoted the same
 * way. Fenced rather than prefixed, because markdown is what this screen
 * renders: inside a fence the operator's words are printed byte for byte, as
 * `D-0045` rule 1 recorded them, and a claim that contains a heading or a list
 * cannot lay itself out as one. The fence is indented into the list item and
 * sized past the longest run of backticks inside it, for `requestBlock`'s
 * reason -- a quotation a claim can end early is a claim that writes the body.
 *
 * The single-line case -- which is every claim typed at a terminal in one
 * breath -- keeps its exact shape, so a claim that always read as a sentence
 * still does. The terminator is added only there, and only when the claim has
 * none of its own: the sentence after it says whose account this is, and a claim
 * already ending in a full stop would otherwise be printed with two.
 *
 * The bound is `CLAIM_LIMIT`'s and is unchanged (#139): the cut says how much
 * it left and where the whole of it still is. In the quoted form the note is a
 * line of its own rather than a tail on the operator's last line, so nothing
 * inside the fence is rondo's words wearing theirs.
 */
function claimBullet(claim: OperatorVerificationClaim): readonly string[] {
  const cut = claim.claim.length - CLAIM_LIMIT;
  const shown = cut > 0 ? claim.claim.slice(0, CLAIM_LIMIT) : claim.claim;
  const note =
    cut > 0
      ? `[...${String(cut)} more characters. The whole of it is on this iteration's row in ` +
        "rondo's store.]"
      : null;
  // **Attributed, not asserted** (D-0045 rule 3), in both shapes: the actor is
  // named and rondo says it neither ran this nor saw it run.
  const said = `- Before answering, \`${listed(claim.actorId, "actor id")}\` said they had checked`;
  const account =
    "That is their own account, recorded before rondo walked the gate; rondo did not run it " +
    "and did not see it run.";
  if (!shown.includes("\n")) {
    const sentence = note === null ? shown : `${shown} ${note}`;
    return [`${said}: ${/[.!?]$/.test(sentence) ? sentence : `${sentence}.`} ${account}`];
  }
  const lines = [...shown.split("\n"), ...(note === null ? [] : [note])];
  const fence = "`".repeat(Math.max(3, longestBacktickRun(shown) + 1));
  return [
    `${said}, quoted below (${String(lines.length)} lines). ${account}`,
    "",
    // Indented into the item so the quotation stays part of the bullet. The
    // indent is stripped from the content by the same rule that keeps the fence
    // inside the list, so what a reader copies out is what the operator typed.
    ...[fence, ...lines, fence].map((line) => (line === "" ? "" : `  ${line}`)),
    "",
  ];
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
