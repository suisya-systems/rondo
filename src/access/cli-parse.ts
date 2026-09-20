/**
 * argv to a command, and nothing else.
 *
 * Lifted out of `./cli.ts` whole (rondo#341 step 2): what is here is the
 * command list, the table of which flags each command reads, and the total
 * function that turns one into the other or says why it will not. Every rule
 * about what a plan is, which verb follows which, and what any of these values
 * mean still lives where it lived -- this module knows argv and nothing about
 * the machine.
 *
 * **It is pure, and that is what the split is for.** The one capability the
 * parser needs is `parseArgs`, which was the whole of `cli.ts`'s `node:util`
 * allowance; moving the parser moves the grant with it, so the module that
 * drives every continuo verb no longer spells a builtin it had stopped using.
 * Nothing here reads a file, opens a store or writes a line.
 */
import { parseArgs } from "node:util";
import { hostFailure } from "./host-failure.js";

/** One command, as the parser understood it. Pure: this type holds no I/O. */
export interface ParsedCommand {
  readonly command:
    | "start"
    | "answer"
    | "revise"
    | "publish"
    | "abandon"
    | "release"
    | "explain"
    | "between"
    | "elevate"
    | "request"
    | "reply"
    | "inbox"
    | "propose"
    | "decide"
    | "scope"
    | "decide-scope"
    | "setup-plan"
    | "retry"
    | "show"
    | "web"
    | "help";
  readonly planFile: string | null;
  /** Every `--plan`, in order: more than one only for `scope` (D-0069 section 1). */
  readonly planFiles: readonly string[];
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
  readonly inReplyTo: string | null;
  readonly observation: string | null;
  readonly basis: string | null;
  readonly successorId: string | null;
  readonly kind: string | null;
  readonly proposalId: string | null;
  readonly contractDigest: string | null;
  readonly outcome: string | null;
  /** D-0066: the scope payload file, and the scope rows the scope verbs name. */
  readonly payloadFile: string | null;
  readonly supersedesScopeId: string | null;
  readonly scopeId: string | null;
  readonly scopeDigest: string | null;
  readonly scopeDecisionId: string | null;
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
  // `multiple` for `scope`, which records one agent type per plan (D-0069
  // section 1); every other command refuses a second `--plan` in `parseCommand`.
  plan: { type: "string", multiple: true },
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
  "in-reply-to": { type: "string" },
  observation: { type: "string" },
  basis: { type: "string" },
  "successor-id": { type: "string" },
  kind: { type: "string" },
  "proposal-id": { type: "string" },
  "contract-digest": { type: "string" },
  outcome: { type: "string" },
  "payload-file": { type: "string" },
  "supersedes-scope-id": { type: "string" },
  "scope-id": { type: "string" },
  "scope-digest": { type: "string" },
  "scope-decision-id": { type: "string" },
  port: { type: "string" },
  "dry-run": { type: "boolean" },
  "allow-remote-mismatch": { type: "boolean" },
  "despite-review": { type: "boolean" },
} as const;

export const COMMANDS = [
  "start",
  "answer",
  "revise",
  "publish",
  "abandon",
  "release",
  "explain",
  "between",
  "elevate",
  "request",
  "reply",
  "inbox",
  "propose",
  "decide",
  "scope",
  "decide-scope",
  "setup-plan",
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
  // `--scope-decision-id` spends a scope on a first admission (D-0069 section
  // 2), through the same call site as `retry`'s, and needs `--message-id`.
  start: ["plan", "prompt", "prompt-file", "iteration-id", "message-id", "scope-decision-id"],
  // `answer` gained `--iteration-id` because more than one iteration may be
  // waiting at once now, which is the whole point of D-0023.
  answer: ["actor-id", "body", "iteration-id", "verified"],
  // `--scope-decision-id` spends a scope on the second lap (D-0070): the gate
  // answer stays the person's, and the lap is the `redo` arm's admission.
  revise: ["actor-id", "body", "iteration-id", "scope-decision-id"],
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
  release: ["iteration-id", "actor-id"],
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
  // D-0061 step 5.1's two verbs, every flag required: the id is a person's
  // for elevate's reason, and the author is always the operator -- no verb
  // writes a drafter message, so none can record a paraphrase as the person's.
  request: ["actor-id", "message-id", "body"],
  reply: ["actor-id", "message-id", "in-reply-to", "body"],
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
  // **Two routes, and the parser keeps them apart.** `--proposal-id` spends one
  // approved contract (D-0047's route S, unchanged). `--iteration-id`,
  // `--successor-id` and `--scope-decision-id` are D-0066's in-scope retry
  // (D-0064 O4), which spends a scope instead: the predecessor whose stored plan
  // runs again, the identity it runs as (a person's to choose, D-0023), and the
  // approval that covers it. Mixing the two is refused in `parseCommand`.
  retry: ["proposal-id", "iteration-id", "successor-id", "scope-decision-id"],
  // **The scope verbs, both pre-continuo like `decide`** (D-0066 sections 1
  // and 2). `scope` writes a row an operator authored, so `--actor-id` is its
  // author and is checked against the allowlist; `decide-scope` copies the
  // digest off the screen for `decide`'s reason -- the answer names the row
  // that was shown, not a position in a list.
  scope: ["payload-file", "actor-id", "supersedes-scope-id", "plan"],
  "decide-scope": ["scope-id", "scope-digest", "outcome", "actor-id"],
  // D-0075 rule 2.1: setup's last step, checked against the approver as every
  // operator verb is. One plan, the one setup composed.
  "setup-plan": ["plan", "actor-id"],
  // One flag, and no `--actor-id`: reading a proposal back is not answering it
  // and not looking at the inbox, so it moves no last-look mark and needs no
  // identity. What it does write is the presentation (D-0036 rule 1), which is
  // a fact about the surface rather than about a person.
  show: ["proposal-id"],
  // No `--actor-id`: whose inbox the page draws is `RONDO_APPROVER`, the same
  // identity every other command checks against, and a second way to name it
  // would be a way to read somebody else's inbox by typing their name.
  // **`--repo`, `--remote` and `--allow-remote-mismatch` for rondo#233 S5**:
  // the page's publish screen needs the one fact no plan carries, and they are
  // the same three flags `publish` takes, read the same way. A host that names
  // no repository serves the page without a publish press.
  web: ["port", "repo", "remote", "allow-remote-mismatch"],
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

  let values: Record<string, string | boolean | string[] | undefined>;
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
    return { kind: "refused", reason: hostFailure(error).text };
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

  // **Two retries, and rondo takes neither when both are named.** A proposal's
  // approval and a scope's approval are two different authorities for one
  // admission (D-0066 rule 3.1), and a command line carrying both has not said
  // which of them is being spent.
  if (
    command === "retry" &&
    values["proposal-id"] !== undefined &&
    (values["scope-decision-id"] !== undefined ||
      values["iteration-id"] !== undefined ||
      values["successor-id"] !== undefined)
  ) {
    return {
      kind: "refused",
      reason:
        "retry --proposal-id spends a proposal's approval, and --iteration-id, --successor-id " +
        "and --scope-decision-id spend a scope's, so they cannot be given together. Name one.",
    };
  }

  const text = (name: string): string | null => {
    const value = values[name];
    return typeof value === "string" ? value : null;
  };

  const planFiles = Array.isArray(values["plan"]) ? values["plan"] : [];
  if (command !== "scope" && planFiles.length > 1) {
    return {
      kind: "refused",
      reason: `--plan is given ${String(planFiles.length)} times, and '${command}' runs one plan. Name one.`,
    };
  }

  // **Every lap names the request it came from** (D-0061 rule 4, D-0083 rule
  // 2). It was required only of a scoped start, for D-0069 section 2's reason
  // -- a refusal with no request has no thread to write its stop into. D-0083
  // makes the request's thread the unit of the page, so a lap with no request
  // is a lap the screen has nowhere to draw, and the requirement is the whole
  // command's. Refused here, before any verdict and before any row.
  if (command === "start" && values["message-id"] === undefined) {
    return {
      kind: "refused",
      reason:
        "start needs --message-id ID, the message that opened the request this lap is for: " +
        "the page draws a lap inside its request's thread, a scope covers only the requests " +
        "it lists, and a refusal is written into that request's thread so it keeps the line " +
        "stopped.",
    };
  }

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
      planFile: planFiles[0] ?? null,
      planFiles,
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
      inReplyTo: text("in-reply-to"),
      observation: text("observation"),
      basis: text("basis"),
      successorId: text("successor-id"),
      kind: text("kind"),
      proposalId: text("proposal-id"),
      contractDigest: text("contract-digest"),
      outcome: text("outcome"),
      payloadFile: text("payload-file"),
      supersedesScopeId: text("supersedes-scope-id"),
      scopeId: text("scope-id"),
      scopeDigest: text("scope-digest"),
      scopeDecisionId: text("scope-decision-id"),
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
    planFiles: [],
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
    inReplyTo: null,
    observation: null,
    basis: null,
    successorId: null,
    kind: null,
    proposalId: null,
    contractDigest: null,
    outcome: null,
    payloadFile: null,
    supersedesScopeId: null,
    scopeId: null,
    scopeDigest: null,
    scopeDecisionId: null,
    port: null,
    dryRun: false,
    allowRemoteMismatch: false,
    despiteReview: false,
  };
}
