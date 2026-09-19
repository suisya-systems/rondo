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
 */

import type { ThreadMessageDraft } from "../store/records.js";
import type { AdvisoryRecord } from "../store/sqlite.js";
import type { CommandOutcome, IssueReadRequest } from "./forge.js";

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
 * Read one reference and say what came of it (sections 2.2 and 2.3), never
 * throwing: every outcome is a `forge` message.
 *
 * `forgeRepo` is where a bare `#N` is read. D-0078's first residual leaves
 * how rondo knows it open; where it is not known, the read fails and says so.
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
      `'${reference.named}' names no repository, and this host was not told the forge ` +
        "repository its pull requests are opened in (rondo web --repo)",
    );
  }
  let answered: Awaited<ReturnType<ForgeIssueRead>>;
  try {
    answered = await read({ host: reference.host, repo, number: reference.number });
  } catch (error) {
    return failed("failed", error instanceof Error ? error.message : String(error));
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
  const latest = new Map<string, ForgeRead>();
  for (const read of issuesRead(messages, requestMessageId)) {
    const key = "read" in read ? read.read.url : `not read: ${read.named}`;
    latest.delete(key);
    latest.set(key, read);
  }
  if (latest.size === 0) {
    return "";
  }
  const blocks = [...latest.values()].map((read) => {
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

/** What the reader reaches, as values a test can replace. */
export interface IssueReaderPorts {
  readonly record: Pick<
    AdvisoryRecord,
    "threadMessages" | "recordThreadMessage" | "messagesBeforeIssueReader"
  >;
  readonly read: ForgeIssueRead;
  /** `OWNER/NAME` a bare `#N` is read in, or null when this host was told none. */
  readonly forgeRepo: string | null;
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
  /** The operator messages still waiting on a read, for the drafter and the page. */
  unread(
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
  let running: Promise<void> | null = null;
  let again = false;

  const unread = async (
    messages: readonly ThreadMessageDraft[],
  ): Promise<ReadonlyMap<string, readonly NamedIssue[]>> =>
    unreadIssues(messages, await ports.record.messagesBeforeIssueReader(ports.now()));

  const scanOnce = async (): Promise<boolean> => {
    const thread = await ports.record.threadMessages();
    if (thread.kind !== "read") {
      ports.log(`issues   the threads could not be read: ${thread.reason}`);
      return false;
    }
    let wrote = false;
    for (const [messageId, left] of await unread(thread.messages)) {
      // Which references are past the bound is by their place in the message,
      // so it does not move with how many were read before a restart.
      const body = thread.messages.find((m) => m.messageId === messageId)?.body ?? "";
      const place = namedIssues(body).map((ref) => ref.named);
      for (const reference of left) {
        const key = `${messageId}\u0000${reference.named}`;
        if (givenUp.has(key)) {
          continue;
        }
        const atMs = ports.now();
        const read: ForgeRead =
          place.indexOf(reference.named) >= MAX_ISSUES_PER_MESSAGE
            ? {
                named: reference.named,
                atMs,
                failed: {
                  why: "too_many",
                  detail: `more than ${String(MAX_ISSUES_PER_MESSAGE)} issues are named in one message`,
                },
              }
            : await readNamedIssue(reference, ports.forgeRepo, ports.read, atMs);
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
        ports.log(
          `issues   the scan stopped: ${error instanceof Error ? error.message : String(error)}`,
        );
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
  };
}
