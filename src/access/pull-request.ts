/**
 * The pull request `publish` opens: its title, its body, and the bounds on both.
 *
 * **Facts in `./forge.ts`, composition here**, which is the division that
 * module already states for itself and `./review.ts` already takes for the
 * verdict. `git` is run over there, by the one module in this layer that may
 * start a process; this file is a total function over what it answered, so
 * every rule about what a pull request says is a unit case with no repository
 * on disk.
 *
 * **Nothing here awaits, stores or prints.** It was lifted out of `./cli.ts`
 * whole (rondo#341): the command line reads argv, drives the verbs and hands
 * this a value that is already on the row, and what comes back is two strings.
 *
 * **Every part is bounded, and so is the sum.** `LIST_LIMIT` bounds how many
 * entries a list has, `LISTED_LIMIT` how large one entry may be, `CLAIM_LIMIT`
 * and `REQUEST_LIMIT` the two pieces of operator free text, and `BODY_LIMIT`
 * the whole. The failure they exist against is asymmetric: a body the forge
 * refuses is refused *after* the push, which is the one leg `publish` cannot
 * take back.
 */

import {
  APPROVED_OUTCOME,
  type IterationRecord,
  type OperatorVerificationClaim,
  planField,
} from "../store/records.js";
import { fileCounts, type LapWorkInspection } from "./forge.js";
import { type NamedIssue, namedIssues } from "./issue-read.js";
import { LIST_LIMIT } from "./review.js";

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
  /**
   * The request's own words -- the message the person wrote, not the lap's
   * prompt -- or null where the thread was not read (rondo#376). Read for the
   * issues it names, which is what {@link issueLines} closes or refers to.
   */
  readonly requestWords?: string | null;
  /** The forge host and `OWNER/NAME` the pull request is opened in, to tell an issue here from one elsewhere. */
  readonly forge?: { readonly host: string; readonly repo: string };
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
  lines.push(...issueLines(input));
  lines.push(
    "This pull request was opened by `rondo publish`, which an operator ran. Merging it is not.",
  );
  return lines.join("\n");
}

/**
 * The issue the request named, as the forge's own keyword (rondo#376, lap 11's
 * N-52: #291 stayed open after the pull request made from it was merged).
 *
 * **Read off the person's own words and nothing else.** The lap's prompt can
 * quote an issue's body, and an issue body names other issues; closing one of
 * those would be rondo acting on something nobody asked it to finish. The
 * request message is what the person wrote (`D-0078`), so an issue named there
 * is the issue the work was asked for.
 *
 * **`Closes` only where that is unambiguous**: exactly one issue, in the
 * repository this pull request is opened in. A merge then closes it, which is
 * the forge doing what the person's merge says -- rondo does not merge. More
 * than one, or one elsewhere, is linked with `Refs` and closed by nobody but
 * the person: rondo cannot tell which of several the work finishes. A pull
 * request the words point at is not an issue and is not named.
 */
function issueLines(input: PullRequestTextInput): readonly string[] {
  const words = input.requestWords ?? null;
  if (words === null) {
    return [];
  }
  const forge = input.forge;
  const here = (issue: NamedIssue) =>
    forge !== undefined &&
    (issue.repo === null || issue.repo.toLowerCase() === forge.repo.toLowerCase()) &&
    (issue.host === null || issue.host.toLowerCase() === forge.host.toLowerCase());
  // **One issue per issue, however many ways it was written** (Codex): `#291`
  // and its address are the same issue, and counting them as two would say
  // `Refs` where the request named exactly one.
  const identity = (issue: NamedIssue) =>
    here(issue)
      ? `#${String(issue.number)}`
      : `${issue.host ?? ""}/${issue.repo ?? ""}#${String(issue.number)}`.toLowerCase();
  const issues = [
    ...new Map(
      namedIssues(words)
        .filter((issue) => !/\/pull\/\d+/.test(issue.named))
        .map((issue) => [identity(issue), issue] as const),
    ).values(),
  ];
  const only = issues.length === 1 ? issues[0] : undefined;
  if (only !== undefined && here(only)) {
    return [
      `Closes #${String(only.number)}`,
      "",
      "The request named this issue, so merging this pull request closes it.",
      "",
    ];
  }
  if (issues.length === 0) {
    return [];
  }
  // Another host's issue keeps its address: `OWNER/NAME#N` is resolved on the
  // pull request's own host, where it would be some other issue (Codex).
  const named = issues.map((issue) =>
    here(issue) || issue.repo === null
      ? `#${String(issue.number)}`
      : issue.host !== null &&
          (forge === undefined || issue.host.toLowerCase() !== forge.host.toLowerCase())
        ? issue.named
        : `${issue.repo}#${String(issue.number)}`,
  );
  return [
    `Refs ${named.join(", ")}`,
    "",
    "The request named these, and rondo closes none of them: which of them this work finishes is " +
      "for whoever merges it to say.",
    "",
  ];
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
