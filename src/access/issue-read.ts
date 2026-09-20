/**
 * What a lap knows of the issue it is sent to fix (D-0078): rondo reads an
 * issue an operator message names, **outside the lap**, records what it read
 * in the request thread as a `forge` message, and quotes it into the prompt.
 *
 * **The lap's fence is not touched.** The read runs in the resident host
 * through the operator's own `gh` (`readIssueFromForge` in `./forge.ts`), and
 * the lap gets text in its prompt; no network rule, credential or `gh` reaches
 * the lap (section 1.2).
 *
 * **The quote is rondo's rendering of stored rows, never a model's retelling**
 * (section 3.4, D-0077 section 3.4's construction): {@link issuesQuote} draws
 * each read byte for byte from its `forge` message under a line rondo writes,
 * so the only words in it that are not the forge's are that framing.
 *
 * **Work is found by rows, as the drafter's is** (section 2.4, D-0071 rule
 * 3.2): an operator message is unread while a reference it names has no
 * `forge` reply, so a restart loses nothing and a message the command line
 * wrote while the host runs is read on the next scan. Messages written before a
 * reading host first ran on the store are not read unasked.
 *
 * **A bare `#N` is read in the repository of the plan the request is drafted
 * from** (D-0081 rule 3.4, D-0078 section 2's annotation), not in one slug the
 * host was started with: since D-0081 one store and one host serve several
 * repositories, and which one a request is in is the plan's fact.
 * {@link bareIssueRepository} is that reckoning, and where it finds more than
 * one repository still in play the read **waits for the person** rather than
 * picking one -- which is the same answer the drafter gives that request
 * (D-0081 rule 2.4). `OWNER/NAME#N` and a web address are unchanged: an
 * explicit name is read where it points.
 */

import type { ThreadMessageDraft } from "../store/records.js";
import type { AdvisoryRecord } from "../store/sqlite.js";
import type { CommandOutcome, IssueReadRequest } from "./forge.js";
import { hostFailure } from "./host-failure.js";
import type { HeldPlan } from "./model-drafter.js";

/** The author id every `forge` message is written under. */
export const ISSUE_READER = "rondo/issue-reader";

/**
 * How many references one message reads (section 2.3). The rest are recorded
 * as not read, one message each, so every reference still has its answer.
 *
 * ponytail: picked, not measured -- five issues is already a split's worth of
 * work. Raise it when a person is seen naming more in one message.
 */
export const MAX_ISSUES_PER_MESSAGE = 5;

/**
 * The most bytes one read may hold (section 2.3), counted over the `forge`
 * message it would write. **Over it is not read, never truncated**: a cut
 * issue reads as a whole one to the worker.
 *
 * ponytail: picked, not measured -- five reads at the bound stay inside the
 * drafter's own 400 000-byte document. Raise it when a real issue is refused.
 */
export const ISSUE_BOUND_BYTES = 60_000;

/**
 * The most bytes the issues one request is given may hold together, counted
 * over the latest read of each name. A read that would take a request past it
 * is not given, whole, as one over {@link ISSUE_BOUND_BYTES} is not.
 *
 * Measured, unlike the two above: continuo takes the prompt as one argument
 * (`--prompt=` in `src/continuo/invoker.ts`), and Linux refuses one argument
 * over 131 072 bytes (`MAX_ARG_STRLEN`). This leaves the rest of that for the
 * request's own words and rondo's framing.
 *
 * ponytail: Windows caps a whole command line near 32 767 characters, so a
 * long issue there fails at the lap's start (said, never cut). A prompt handed
 * over by file or standard input is the upgrade, and it is continuo's to offer.
 */
export const REQUEST_ISSUES_BOUND_BYTES = 96_000;

/** The most a lap's whole prompt may hold, from the same `MAX_ARG_STRLEN`, with room for the language line. */
export const PROMPT_TRANSPORT_BOUND_BYTES = 128_000;

/** One reference as the person wrote it, and where it points. */
export interface NamedIssue {
  /** The text as written in the message, which is also what a read answers. */
  readonly named: string;
  /** The host a web address named, or null for `gh`'s own. */
  readonly host: string | null;
  /** `OWNER/NAME`, or null for a bare `#N` (the store's forge repository). */
  readonly repo: string | null;
  readonly number: number;
}

// A web address to an issue or a pull request, `OWNER/NAME#N`, or a bare `#N`
// not glued to a word or an HTML entity (`&#39;`). One alternation scanned
// left to right, so a reference inside an address is not read twice.
const REFERENCE =
  /https?:\/\/([^\s/]+)\/([\w.-]+)\/([\w.-]+)\/(?:issues|pull)\/(\d+)|(?<![\w&/.-])([\w.-]+\/[\w.-]+)#(\d+)\b|(?<![\w&])#(\d+)\b/g;

/** Every issue `body` names, in the order it names them, each once (section 2.1). */
export function namedIssues(body: string): readonly NamedIssue[] {
  const found = new Map<string, NamedIssue>();
  for (const m of body.matchAll(REFERENCE)) {
    const [named, host, owner, name, urlNumber, repo, repoNumber, bareNumber] = m;
    const number = Number(urlNumber ?? repoNumber ?? bareNumber);
    if (!Number.isSafeInteger(number) || number <= 0 || found.has(named)) {
      continue;
    }
    found.set(
      named,
      urlNumber !== undefined
        ? { named, host: host ?? null, repo: `${String(owner)}/${String(name)}`, number }
        : { named, host: null, repo: repo ?? null, number },
    );
  }
  return [...found.values()];
}

/** Why a reference was not read, in the terms D-0076 rule 4 sorts them by. */
export type IssueReadFailure =
  /** No `gh` on this machine: only installation repairs it (rule 4.3). */
  | "no_gh"
  /** `gh` is not signed in: likewise (rule 4.3). */
  | "signed_out"
  /** A bare `#N`, and this host was told no forge repository to read it in. */
  | "no_repo"
  /** The forge says there is no such issue, or not one this account can see (rule 4.4). */
  | "missing"
  /** The forge refused this account (rule 4.4). */
  | "refused"
  /** Over {@link ISSUE_BOUND_BYTES}: not handed over rather than handed over cut. */
  | "too_long"
  /** Past {@link MAX_ISSUES_PER_MESSAGE} in one message. */
  | "too_many"
  /** Anything else: a timeout, the network, an answer rondo could not read. */
  | "failed";

const FAILURES: readonly IssueReadFailure[] = [
  "no_gh",
  "signed_out",
  "no_repo",
  "missing",
  "refused",
  "too_long",
  "too_many",
  "failed",
];

/** One comment, as the forge returned it. */
export interface IssueComment {
  readonly author: string;
  readonly at: string;
  readonly body: string;
}

/** What was read of one issue: every string the forge's, byte for byte. */
export interface IssueText {
  readonly url: string;
  readonly number: number;
  readonly pullRequest: boolean;
  readonly title: string;
  readonly state: string;
  readonly author: string;
  readonly openedAt: string;
  readonly body: string;
  readonly comments: readonly IssueComment[];
}

/** A `forge` message's body, read back: the reference, when, and what came of it. */
export type ForgeRead = {
  readonly named: string;
  readonly atMs: number;
} & (
  | { readonly read: IssueText }
  | { readonly failed: { readonly why: IssueReadFailure; readonly detail: string } }
);

/**
 * The body of a `forge` message (section 3.1): rondo's framing -- the
 * reference and the time of the read first -- around the forge's text. JSON,
 * so every string comes back exactly as it went in.
 */
export function forgeBody(read: ForgeRead): string {
  return JSON.stringify({
    rondo_issue_read: 1,
    named: read.named,
    at_ms: read.atMs,
    ...("read" in read ? { read: read.read } : { failed: read.failed }),
  });
}

/** A `forge` message's body read back, or null when it is not one rondo wrote. */
export function parseForgeRead(body: string): ForgeRead | null {
  let row: unknown;
  try {
    row = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(row) || row["rondo_issue_read"] !== 1) {
    return null;
  }
  const named = row["named"];
  const atMs = row["at_ms"];
  if (typeof named !== "string" || typeof atMs !== "number") {
    return null;
  }
  const failed = row["failed"];
  if (isRecord(failed)) {
    const why = failed["why"];
    const detail = failed["detail"];
    return FAILURES.includes(why as IssueReadFailure) && typeof detail === "string"
      ? { named, atMs, failed: { why: why as IssueReadFailure, detail } }
      : null;
  }
  const read = issueText(row["read"]);
  return read === null ? null : { named, atMs, read };
}

function issueText(value: unknown): IssueText | null {
  if (!isRecord(value) || !Array.isArray(value["comments"])) {
    return null;
  }
  const strings = ["url", "title", "state", "author", "openedAt", "body"] as const;
  if (
    !strings.every((key) => typeof value[key] === "string") ||
    typeof value["number"] !== "number" ||
    typeof value["pullRequest"] !== "boolean"
  ) {
    return null;
  }
  const comments = value["comments"].map(comment);
  return comments.every((c) => c !== null)
    ? { ...(value as unknown as IssueText), comments: comments as IssueComment[] }
    : null;
}

function comment(value: unknown): IssueComment | null {
  return isRecord(value) &&
    typeof value["author"] === "string" &&
    typeof value["at"] === "string" &&
    typeof value["body"] === "string"
    ? { author: value["author"], at: value["at"], body: value["body"] }
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** How the page and the prompt name an issue: as the person wrote it, or `OWNER/NAME#N` for an address. */
export function issueName(read: ForgeRead): string {
  const m = /^https?:\/\/[^\s/]+\/([\w.-]+\/[\w.-]+)\/(?:issues|pull)\/(\d+)$/.exec(read.named);
  return m === null ? read.named : `${String(m[1])}#${String(m[2])}`;
}

/** What {@link readIssueFromForge} answers, as a port a test replaces. */
export type ForgeIssueRead = (request: IssueReadRequest) => Promise<{
  readonly issue: CommandOutcome;
  readonly comments: CommandOutcome | null;
}>;

/**
 * Where a bare `#N` in one request is read, or that nothing has said yet.
 *
 * `repo` null is "no plan in play names a repository and this host was told
 * none": the read fails with `no_repo` and says so, as it does today.
 */
export type BareIssueRepository =
  | { readonly repo: string | null }
  /** Several repositories are still in play: the read waits (D-0081 rule 2.4). */
  | { readonly disputed: true };

/** What {@link bareIssueRepository} reads, as values a test replaces. */
export interface BareRepositoryPorts {
  readonly record: Pick<AdvisoryRecord, "scopesFor">;
  /** The plans rondo holds for this request (`heldPlans`): what a draft picks among. */
  readonly held: (requestMessageId: string) => Promise<readonly HeldPlan[]>;
  /**
   * The host's `--repo`, for a store whose plans carry no slug: every row
   * written before the slug moved onto the plan means "this plan names none",
   * and such a store publishes and reads by the flag as it always has
   * (D-0081 rule 6.3).
   */
  readonly hostRepo: string | null;
}

/**
 * The repository a bare `#N` in `requestMessageId` is read in (D-0081 rule
 * 3.4): the one named by the plan the request is drafted from.
 *
 * **Which plans are in play is read off the rows, never guessed.** The plans
 * rondo holds for the request are what a draft picks among (rule 2.2: with
 * several repositories held, the choice of template is the choice of
 * repository), and a scope written for the request -- the drafter's split or
 * the person's own -- has already said which workspaces the work runs in
 * (D-0066 rule 1.2.2), so the plans it does not name are out of play. Where
 * one repository is left, that is the answer, which is every store holding one
 * repository and every store set up before D-0081. Where more than one is
 * left, nothing has said which and **the answer is the person's**: the drafter
 * asks back and rondo starts nothing until it is answered (rule 2.4), and this
 * says `disputed` so the read waits for the same answer instead of guessing.
 *
 * `namedAtMs` is when the message naming the reference was written. A scope
 * older than it was written without knowing of that message, so it does not
 * settle it: see below.
 */
export async function bareIssueRepository(
  ports: BareRepositoryPorts,
  requestMessageId: string,
  namedAtMs: number,
): Promise<BareIssueRepository> {
  const held = await ports.held(requestMessageId);
  // **The scope in force, not every scope this request ever had.** A scope the
  // person changed says where the work ran before they changed it, and a draft
  // the drafter wrote again over (D-0071 rule 3.1) says where an earlier
  // reading of the request would have run; counting either would leave a
  // repository in play that nothing still names, and the read waiting for
  // ever. The newest scope no other scope replaces is what stands.
  //
  // **And only if it is newer than the message that named the issue.** A
  // person who replies in a thread with work in another repository is
  // answered, on the reader's own pass, before any draft over that reply can
  // exist -- so an older scope would settle the new reference on the old
  // repository and record the wrong issue as read for good. Older, it settles
  // nothing, and the reference waits for the draft over the reply.
  const scopes = await ports.record.scopesFor(requestMessageId);
  const replaced = new Set(scopes.flatMap((scope) => scope.supersedesScopeId ?? []));
  const inForce = scopes
    .filter((scope) => !replaced.has(scope.scopeId) && scope.createdAtMs >= namedAtMs)
    .at(-1);
  // Byte for byte against the plan's own `repository`, as the store's own
  // re-test of a scope compares them (D-0066 rule 1.2.2).
  const scoped = new Set(inForce?.payload.workspaces.map((workspace) => workspace.repository));
  const inPlay = scoped.size === 0 ? held : held.filter((plan) => scoped.has(plan.repository));
  // **The answer is per repository, not per plan.** Setup may be run again for
  // a repository it already recorded -- which is how a store set up before
  // D-0081 comes to name its slug at all (rule 6.2) -- so one repository can
  // hold both a plan that names its slug and an older one that names none.
  // Within a repository, the plan that names one is that repository's record
  // of it and the one that names none says nothing about it; a repository no
  // plan of which names one is the host's `--repo` (rule 6.3), and where the
  // host names none too, its repository is simply not known and counts as
  // itself -- so standing beside a second repository's it is two answers and
  // not agreement.
  const named = new Map<string, Set<string>>();
  for (const plan of inPlay) {
    const slugs = named.get(plan.repository) ?? new Set<string>();
    named.set(plan.repository, slugs);
    if (plan.forgeRepository !== null) {
      slugs.add(plan.forgeRepository);
    }
  }
  const candidates = new Set<string | null>(
    [...named.values()].flatMap((slugs) => (slugs.size === 0 ? [ports.hostRepo] : [...slugs])),
  );
  return candidates.size > 1 ? { disputed: true } : { repo: [...candidates][0] ?? ports.hostRepo };
}

/**
 * Read one reference and say what came of it (sections 2.2 and 2.3), never
 * throwing: every outcome is a `forge` message.
 *
 * `forgeRepo` is where a bare `#N` is read, which {@link bareIssueRepository}
 * settles; where no repository is known, the read fails and says so.
 */
export async function readNamedIssue(
  reference: NamedIssue,
  forgeRepo: string | null,
  read: ForgeIssueRead,
  atMs: number,
): Promise<ForgeRead> {
  const failed = (why: IssueReadFailure, detail: string): ForgeRead => ({
    named: reference.named,
    atMs,
    failed: { why, detail },
  });
  const repo = reference.repo ?? forgeRepo;
  if (repo === null) {
    return failed(
      "no_repo",
      `'${reference.named}' names no repository, and no plan this request could run on names ` +
        "the repository it would be read in (D-0081 rule 3.4; setup records it, and rondo web " +
        "--repo still answers for a store set up before it did)",
    );
  }
  let answered: Awaited<ReturnType<ForgeIssueRead>>;
  try {
    answered = await read({ host: reference.host, repo, number: reference.number });
  } catch (error) {
    return failed("failed", hostFailure(error).text);
  }
  const issueFailure = commandFailure(answered.issue);
  if (issueFailure !== null) {
    return failed(issueFailure.why, issueFailure.detail);
  }
  const comments = answered.comments;
  if (comments === null) {
    return failed("failed", `${answered.issue.commandLine}: no comments were read`);
  }
  const commentsFailure = commandFailure(comments);
  if (commentsFailure !== null) {
    return failed(commentsFailure.why, commentsFailure.detail);
  }
  const text = issueFromForge(answered.issue.stdout, comments.stdout);
  if (typeof text === "string") {
    return failed("failed", `${answered.issue.commandLine}: ${text}`);
  }
  const whole: ForgeRead = { named: reference.named, atMs, read: text };
  const bytes = new TextEncoder().encode(forgeBody(whole)).length;
  return bytes > ISSUE_BOUND_BYTES
    ? failed(
        "too_long",
        `the read holds ${String(bytes)} bytes, over the bound of ${String(ISSUE_BOUND_BYTES)}`,
      )
    : whole;
}

/** Why a command did not answer, sorted by who can repair it, or null when it did. */
function commandFailure(
  outcome: CommandOutcome,
): { readonly why: IssueReadFailure; readonly detail: string } | null {
  if (outcome.spawnError !== null) {
    return {
      why: /ENOENT/.test(outcome.spawnError) ? "no_gh" : "failed",
      detail: `${outcome.commandLine}: ${outcome.spawnError}`,
    };
  }
  if (outcome.status === 0) {
    return null;
  }
  const said = outcome.stderr.trim();
  const detail = `${outcome.commandLine}: ${said === "" ? `exited ${String(outcome.status)}` : said}`;
  if (/gh auth login|HTTP 401|not logged in/i.test(said)) {
    return { why: "signed_out", detail };
  }
  if (/HTTP 404|Not Found/i.test(said)) {
    return { why: "missing", detail };
  }
  if (/HTTP 403/i.test(said)) {
    return { why: "refused", detail };
  }
  return { why: "failed", detail };
}

/** The issue and its comments out of `gh api`'s output, or why they will not read. */
function issueFromForge(issueJson: string, commentLines: string): IssueText | string {
  let issue: unknown;
  try {
    issue = JSON.parse(issueJson);
  } catch {
    return "the issue's answer is not JSON";
  }
  if (!isRecord(issue)) {
    return "the issue's answer is not an object";
  }
  const user = issue["user"];
  const url = issue["html_url"];
  const title = issue["title"];
  const state = issue["state"];
  const number = issue["number"];
  const openedAt = issue["created_at"];
  const body = issue["body"];
  if (
    typeof url !== "string" ||
    typeof title !== "string" ||
    typeof state !== "string" ||
    typeof number !== "number" ||
    typeof openedAt !== "string" ||
    !(body === null || typeof body === "string")
  ) {
    return "the issue's answer lacks its title, state, number, address or body";
  }
  const comments: IssueComment[] = [];
  for (const line of commentLines.split("\n")) {
    if (line.trim() === "") {
      continue;
    }
    let row: unknown;
    try {
      row = JSON.parse(line);
    } catch {
      return "a comment's answer is not JSON";
    }
    if (!isRecord(row) || !(row["body"] === null || typeof row["body"] === "string")) {
      return "a comment's answer lacks its body";
    }
    comments.push({
      author: typeof row["author"] === "string" ? row["author"] : "",
      at: typeof row["at"] === "string" ? row["at"] : "",
      body: row["body"] ?? "",
    });
  }
  return {
    url,
    number,
    pullRequest: isRecord(issue["pull_request"]),
    title,
    state,
    author: isRecord(user) && typeof user["login"] === "string" ? user["login"] : "",
    openedAt,
    body: body ?? "",
    comments,
  };
}

/** The request a message belongs to: the root of its reply chain. */
function rootsOf(
  messages: readonly ThreadMessageDraft[],
): (messageId: string) => string | undefined {
  const parent = new Map(messages.map((m) => [m.messageId, m.inReplyTo]));
  return (messageId) => {
    let at = messageId;
    for (let hops = 0; hops <= messages.length; hops += 1) {
      const up = parent.get(at);
      if (up === undefined) {
        return undefined;
      }
      if (up === null) {
        return at;
      }
      at = up;
    }
    return undefined;
  };
}

/** The request `messageId` belongs to, or undefined when its chain opens none. */
export function requestOf(
  messages: readonly ThreadMessageDraft[],
  messageId: string,
): string | undefined {
  return rootsOf(messages)(messageId);
}

/** Every `forge` message under `requestMessageId`, read back, oldest first. */
export function issuesRead(
  messages: readonly ThreadMessageDraft[],
  requestMessageId: string,
): readonly ForgeRead[] {
  const rootOf = rootsOf(messages);
  return messages.flatMap((m) => {
    if (m.authorKind !== "forge" || rootOf(m.messageId) !== requestMessageId) {
      return [];
    }
    const read = parseForgeRead(m.body);
    return read === null ? [] : [read];
  });
}

/**
 * The latest read of each reference under `requestMessageId`, by the name the
 * person wrote, in the order they were first read: what the worker is given
 * and what the scope screen says it is given, from one reckoning.
 */
export function latestReads(
  messages: readonly ThreadMessageDraft[],
  requestMessageId: string,
): readonly ForgeRead[] {
  const latest = new Map<string, ForgeRead>();
  for (const read of issuesRead(messages, requestMessageId)) {
    latest.set(read.named, read);
  }
  return [...latest.values()];
}

/**
 * The operator messages with a reference not yet answered by a `forge` reply,
 * and which references (sections 2.4 and 3.3). `before` is what the reader does
 * not read unasked: messages written before it first ran on this store.
 */
export function unreadIssues(
  messages: readonly ThreadMessageDraft[],
  before: ReadonlySet<string>,
): ReadonlyMap<string, readonly NamedIssue[]> {
  const answered = new Map<string, Set<string>>();
  for (const m of messages) {
    const read = m.authorKind === "forge" ? parseForgeRead(m.body) : null;
    if (read !== null && m.inReplyTo !== null) {
      answered.set(m.inReplyTo, (answered.get(m.inReplyTo) ?? new Set()).add(read.named));
    }
  }
  const unread = new Map<string, readonly NamedIssue[]>();
  for (const m of messages) {
    if (m.authorKind !== "operator" || before.has(m.messageId)) {
      continue;
    }
    const done = answered.get(m.messageId);
    const left = namedIssues(m.body).filter((ref) => done?.has(ref.named) !== true);
    if (left.length > 0) {
      unread.set(m.messageId, left);
    }
  }
  return unread;
}

/**
 * The line that opens the quoted section of a lap's prompt. Exported so a
 * lap's prompt can be compared with the plan it was admitted from (a drafted
 * start's "already started" check), which is that plan's prompt plus this.
 */
export const ISSUES_QUOTE_OPENING =
  "\n\n---\nThe issues this request names, as rondo read them from the forge";

/**
 * The section that ends a lap's prompt (sections 3.4 to 3.6), or "" when the
 * request's thread holds no `forge` message.
 *
 * **Drawn from the rows, never written by a model.** Each read is its `forge`
 * message's strings byte for byte under a line rondo writes; a reference named
 * again later is quoted as of its latest read; one that could not be read is
 * one line saying so, so the worker does not try the fence as lap 10's did.
 */
export function issuesQuote(
  messages: readonly ThreadMessageDraft[],
  requestMessageId: string,
): string {
  const latest = latestReads(messages, requestMessageId);
  if (latest.length === 0) {
    return "";
  }
  const blocks = latest.map((read) => {
    const name = issueName(read);
    if ("failed" in read) {
      return (
        `=== ${name} was named in the request and could not be read, so there is nothing ` +
        "of it here: work from the request."
      );
    }
    const issue = read.read;
    return [
      `=== ${name} (${issue.pullRequest ? "pull request" : "issue"}, ${issue.state}), read at ` +
        `${new Date(read.atMs).toISOString()} from ${issue.url}`,
      `Title: ${issue.title}`,
      `Opened by ${issue.author} at ${issue.openedAt}:`,
      issue.body,
      ...issue.comments.flatMap((c) => ["", `--- comment by ${c.author} at ${c.at}:`, c.body]),
    ].join("\n");
  });
  return (
    `${ISSUES_QUOTE_OPENING} when the request was written. Under each "===" line is the ` +
    'forge\'s own text, byte for byte; rondo wrote only the "===", "Title:", "Opened by" and ' +
    '"--- comment by" lines. Links in it were not followed and cannot be opened from here.\n\n' +
    blocks.join("\n\n")
  );
}

/**
 * `read`, or a `too_long` failure when it would take its request's reads past
 * {@link REQUEST_ISSUES_BOUND_BYTES} together: counted over the latest read of
 * each other name, since a name read again replaces its earlier read.
 */
function withinRequest(read: ForgeRead, already: readonly ForgeRead[]): ForgeRead {
  if (!("read" in read)) {
    return read;
  }
  const size = (one: ForgeRead): number => new TextEncoder().encode(forgeBody(one)).length;
  const total = already
    .filter((one) => "read" in one && one.named !== read.named)
    .reduce((sum, one) => sum + size(one), size(read));
  return total <= REQUEST_ISSUES_BOUND_BYTES
    ? read
    : {
        named: read.named,
        atMs: read.atMs,
        failed: {
          why: "too_long",
          detail:
            `with the issues this request was already given it would hold ${String(total)} ` +
            `bytes, over the bound of ${String(REQUEST_ISSUES_BOUND_BYTES)}`,
        },
      };
}

/** What the reader reaches, as values a test can replace. */
export interface IssueReaderPorts {
  readonly record: Pick<
    AdvisoryRecord,
    "threadMessages" | "recordThreadMessage" | "messagesBeforeIssueReader"
  >;
  readonly read: ForgeIssueRead;
  /**
   * Where a bare `#N` in one request is read (D-0081 rule 3.4):
   * {@link bareIssueRepository} over the store's rows, asked by the request
   * and by when the message naming the reference was written.
   */
  readonly bareRepository: (
    requestMessageId: string,
    namedAtMs: number,
  ) => Promise<BareIssueRepository>;
  readonly now: () => number;
  /** A fresh message id. */
  readonly mintId: () => string;
  /** One line for the host's terminal. */
  readonly log: (line: string) => void;
  /** Called after a scan wrote anything: the drafter may now be due (section 3.3). */
  readonly onRead: () => void;
}

export interface IssueReader {
  /** Look for unread references now. Returns at once. */
  kick(): void;
  /** Resolves once no scan is in flight. */
  idle(): Promise<void>;
  /**
   * The operator messages still waiting on a read: what the page says is not
   * read yet, and what the lap's door waits on, so nothing starts without an
   * issue its request named.
   */
  unread(
    messages: readonly ThreadMessageDraft[],
  ): Promise<ReadonlyMap<string, readonly NamedIssue[]>>;
  /**
   * {@link unread} without the references waiting on which repository their
   * request is in (D-0081 rule 3.4): **what holds the drafter**.
   *
   * The drafter waits for a read that is coming (D-0078 section 3.3), and a
   * disputed one is not coming until the person answers -- an answer the
   * drafter's own ask is what asks for (D-0081 rule 2.4). Holding the drafter
   * for it would leave the question unasked and the read waiting on it for
   * ever. The lap's door keeps waiting on the whole of {@link unread}, so the
   * drafter asking is all that happens meanwhile.
   *
   * ponytail: **the draft that settles the repository is composed before the
   * read it settles**, and is not drafted again over it -- the store holds a
   * thread whose every operator message a drafter row covers to be drafted and
   * writes nothing twice (D-0071 rule 3.2). So in a store holding several
   * repositories the issue reaches such a request at the lap's door, quoted
   * (`withNamedIssues`) and on the scope screen, but not in the drafted
   * prompt. Drafting again over a landed read is the upgrade, and it is
   * rule 3.2's coverage to change, not this reader's.
   */
  unreadUnderway(
    messages: readonly ThreadMessageDraft[],
  ): Promise<ReadonlyMap<string, readonly NamedIssue[]>>;
}

/**
 * The host's reader (section 2.4): once per reference, when the message is
 * written, one read at a time, nobody waiting on it.
 *
 * ponytail: two hosts over one store may both read one reference and write
 * two `forge` messages for it; the quote keeps the later. A lease like the
 * drafter's is the upgrade if two hosts are ever run.
 */
export function issueReader(ports: IssueReaderPorts): IssueReader {
  // A reference whose message the store refused, not tried again by this
  // process: a refusal is the store's answer, not a fault of the moment.
  const givenUp = new Set<string>();
  // A reference already said to be waiting on its repository, so a rescan every
  // minute does not say it again.
  const saidWaiting = new Set<string>();
  let running: Promise<void> | null = null;
  let again = false;

  const unread = async (
    messages: readonly ThreadMessageDraft[],
  ): Promise<ReadonlyMap<string, readonly NamedIssue[]>> =>
    unreadIssues(messages, await ports.record.messagesBeforeIssueReader(ports.now()));

  /**
   * {@link IssueReaderPorts.bareRepository}, asked once per (request, message)
   * in one pass: the answer turns on when the naming message was written, so
   * two messages of one request are two questions.
   */
  const whereBareReads = (): ((
    requestMessageId: string,
    messageId: string,
    namedAtMs: number,
  ) => Promise<BareIssueRepository>) => {
    const asked = new Map<string, Promise<BareIssueRepository>>();
    return (requestMessageId, messageId, namedAtMs) => {
      const key = `${requestMessageId}\u0000${messageId}`;
      let answer = asked.get(key);
      if (answer === undefined) {
        answer = ports.bareRepository(requestMessageId, namedAtMs);
        asked.set(key, answer);
      }
      return answer;
    };
  };

  const unreadUnderway = async (
    messages: readonly ThreadMessageDraft[],
  ): Promise<ReadonlyMap<string, readonly NamedIssue[]>> => {
    const where = whereBareReads();
    const underway = new Map<string, readonly NamedIssue[]>();
    for (const [messageId, references] of await unread(messages)) {
      const namedAtMs = messages.find((m) => m.messageId === messageId)?.atMs ?? 0;
      const left = references.some((reference) => reference.repo === null)
        ? "disputed" in
          (await where(requestOf(messages, messageId) ?? messageId, messageId, namedAtMs))
          ? references.filter((reference) => reference.repo !== null)
          : references
        : references;
      if (left.length > 0) {
        underway.set(messageId, left);
      }
    }
    return underway;
  };

  const scanOnce = async (): Promise<boolean> => {
    const thread = await ports.record.threadMessages();
    if (thread.kind !== "read") {
      ports.log(`issues   the threads could not be read: ${thread.reason}`);
      return false;
    }
    let wrote = false;
    const rootOf = rootsOf(thread.messages);
    const where = whereBareReads();
    // Each request's latest read per name, kept current as this scan writes,
    // so the bound counts what an earlier reference in this scan was given.
    const given = new Map<string, Map<string, ForgeRead>>();
    const givenTo = (root: string): Map<string, ForgeRead> => {
      let reads = given.get(root);
      if (reads === undefined) {
        reads = new Map(latestReads(thread.messages, root).map((r) => [r.named, r]));
        given.set(root, reads);
      }
      return reads;
    };
    for (const [messageId, left] of await unread(thread.messages)) {
      const root = rootOf(messageId) ?? messageId;
      const request = givenTo(root);
      // Which references are past the bound is by their place in the message,
      // so it does not move with how many were read before a restart.
      const named = thread.messages.find((m) => m.messageId === messageId);
      const body = named?.body ?? "";
      const place = namedIssues(body).map((ref) => ref.named);
      for (const reference of left) {
        const key = `${messageId}\u0000${reference.named}`;
        if (givenUp.has(key)) {
          continue;
        }
        const atMs = ports.now();
        let read: ForgeRead;
        if (place.indexOf(reference.named) >= MAX_ISSUES_PER_MESSAGE) {
          read = {
            named: reference.named,
            atMs,
            failed: {
              why: "too_many",
              detail: `more than ${String(MAX_ISSUES_PER_MESSAGE)} issues are named in one message`,
            },
          };
        } else {
          // **A bare `#N` waits rather than being read somewhere chosen for the
          // person** (D-0081 rules 2.4 and 3.4). Nothing is written, so the
          // reference stays unread: the lap's door keeps refusing, the drafter
          // asks which work is meant, and the next scan after the answer reads
          // it. An explicit `OWNER/NAME#N` or address asks nothing of this.
          const reads: BareIssueRepository =
            reference.repo === null
              ? await where(root, messageId, named?.atMs ?? 0)
              : { repo: reference.repo };
          if ("disputed" in reads) {
            const key = `${messageId}\u0000${reference.named}`;
            if (!saidWaiting.has(key)) {
              saidWaiting.add(key);
              ports.log(
                `issues   ${messageId}: ${reference.named} waits on which repository this ` +
                  "request is in",
              );
            }
            continue;
          }
          read = withinRequest(await readNamedIssue(reference, reads.repo, ports.read, atMs), [
            ...request.values(),
          ]);
        }
        const outcome = await ports.record.recordThreadMessage({
          messageId: ports.mintId(),
          body: forgeBody(read),
          authorKind: "forge",
          authorId: ISSUE_READER,
          inReplyTo: messageId,
          atMs,
          bases: [],
          asks: false,
        });
        if (outcome.kind === "recorded") {
          wrote = true;
          request.set(read.named, read);
          ports.log(
            `issues   ${messageId}: ${reference.named} ${"read" in read ? "read" : `not read (${read.failed.why})`}`,
          );
        } else {
          givenUp.add(key);
          ports.log(`issues   ${messageId}: ${reference.named} not recorded: ${outcome.reason}`);
        }
      }
    }
    return wrote;
  };

  const loop = async (): Promise<void> => {
    while (again) {
      again = false;
      try {
        if (await scanOnce()) {
          ports.onRead();
        }
      } catch (error) {
        ports.log(`issues   the scan stopped: ${hostFailure(error).text}`);
      }
    }
  };

  const kick = (): void => {
    again = true;
    if (running === null) {
      running = loop().finally(() => {
        running = null;
        if (again) {
          kick();
        }
      });
    }
  };
  return {
    kick,
    async idle() {
      while (running !== null) {
        await running;
      }
    },
    unread,
    unreadUnderway,
  };
}
